/**
 * Privacy-first Sentry diagnostics service.
 *
 * Single module that owns all Sentry SDK interaction. The rest of the app
 * never imports `@sentry/react-native` directly. Design invariants:
 *
 *  - The SDK becomes ready (Sentry.init runs) at most ONCE per process,
 *    gated only by a configured DSN and an environment that permits
 *    reporting — NEVER by consent. Being ready must not itself authorize
 *    transmission (see docs/specs/anonymous-diagnostics-consent-v0.1.md §2).
 *  - Passive/automatic capture (`captureHandledError`, breadcrumbs) is gated
 *    at send time by the `anonymousDiagnosticsEnabled` consent flag via
 *    `beforeSend`/`beforeBreadcrumb`. An explicit one-shot report
 *    (`reportOneShot`) is tagged so it alone bypasses that gate.
 *  - Feedback (`submitFeedbackViaSentry`) is architecturally independent of
 *    the consent gate: Sentry's `captureFeedback` produces a `type: "feedback"`
 *    event, and the SDK only ever runs `beforeSend` for events with no `type`
 *    (see `@sentry/core` `isErrorEvent`/`processBeforeSend`) — feedback never
 *    passes through it, by design of the SDK itself.
 *  - Every outbound event and breadcrumb passes through the centralized
 *    sanitizer (`services/sanitize.ts`). Anything that cannot be confidently
 *    sanitized is dropped.
 *  - `enableAutoSessionTracking` is fixed for the life of the process at the
 *    moment the native SDK initializes and cannot be toggled at runtime (the
 *    RN SDK calls `NATIVE.initNativeSdk()` exactly once, unconditionally, from
 *    inside `Sentry.init()`). It is set from whatever the consent state is at
 *    that first call, so a mid-session consent change takes effect for
 *    session/release-health telemetry on the *next* launch — never a leak,
 *    since it can only ever be conservative (no session tracking starts
 *    without consent already granted at launch).
 *  - Failures fail closed and never block app startup or leak raw data.
 *
 * See `docs/sentry-setup.md` for configuration and required EAS secrets.
 */

import Constants from 'expo-constants'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sentry from '@sentry/react-native'
import {
  sanitizeEvent,
  sanitizeBreadcrumb,
  normalizeError,
  isSafeEnumToken,
  type SentryLikeEvent,
  type SentryLikeBreadcrumb,
} from './sanitize'
import {
  getSafeBuildMetadata,
  getReleaseString,
  deriveConnectionMode,
  type ConnectionMode,
} from './safe-metadata'
import { getSentryInstallId, clearSentryInstallId } from './sentry-install-id'

/** Public runtime env var for the DSN. Never a secret token — the DSN is safe
 * to embed in a client bundle by design. Auth tokens (source-map upload) live
 * only in the EAS build environment, never here. */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN
const SENTRY_DEBUG = process.env.EXPO_PUBLIC_SENTRY_DEBUG === '1'

/** Conservative error sampling. We are not doing performance tracing at all. */
const ERROR_SAMPLE_RATE = 1.0

/** Tag marking a single event as an explicit, user-authorized one-shot report
 * — the only thing `beforeSend` lets through while standing consent is off.
 * Stripped from the event before it's sanitized/sent. */
const ONE_SHOT_TAG = 'diagnostics.one_shot'

/** Whether Sentry.init has run. Becomes true at most once per process — SDK
 * readiness is independent of consent (see module doc). */
let sdkReady = false

/** Standing Anonymous Diagnostics consent. Gates passive capture via
 * beforeSend/beforeBreadcrumb; does NOT gate feedback (see module doc) or an
 * explicit one-shot report (tagged with ONE_SHOT_TAG). */
let diagnosticsEnabled = false

/** Resolve the environment name for tagging (safe, coarse). */
function resolveEnvironment(): string {
  if (__DEV__) return 'development'
  // `channel` distinguishes preview/internal vs production EAS builds.
  const channel = (Constants.expoConfig as { extra?: { eas?: { channel?: string } } } | null)?.extra
    ?.eas?.channel
  const meta = getSafeBuildMetadata()
  return meta.easChannel || channel || 'production'
}

/**
 * Whether the current build environment permits reporting at all. We do not
 * transmit from local development by default (it would spam the dashboard with
 * noise and risk unsanitized dev data) — only from real builds.
 */
export function environmentPermitsReporting(): boolean {
  // Allow an explicit override for internal QA of the pipeline.
  if (process.env.EXPO_PUBLIC_SENTRY_ALLOW_DEV === '1') return true
  return !__DEV__
}

/** Whether a DSN is configured. */
export function isDsnConfigured(): boolean {
  return typeof DSN === 'string' && DSN.length > 0
}

/**
 * beforeSend hook — the consent gate AND the last line of defense.
 *
 * Only ever invoked by the SDK for events with no `type` (plain errors/
 * messages) — feedback events bypass it entirely at the SDK level. Blocks
 * every such event unless standing consent is on, or the event carries the
 * one-shot authorization tag (set by `reportOneShot` for exactly one send).
 * Whatever gets through still goes through the allowlist sanitizer.
 */
function beforeSend(event: SentryLikeEvent): SentryLikeEvent | null {
  try {
    const tags = (event as { tags?: Record<string, unknown> })?.tags
    const oneShotAuthorized = tags?.[ONE_SHOT_TAG] === '1'
    if (!diagnosticsEnabled && !oneShotAuthorized) return null
    if (tags && ONE_SHOT_TAG in tags) delete tags[ONE_SHOT_TAG]
    return sanitizeEvent(event)
  } catch {
    return null // fail closed
  }
}

/**
 * beforeBreadcrumb hook — blocks every breadcrumb while standing consent is
 * off (a breadcrumb recorded pre-consent must never exist to leak into a
 * later one-shot report), and otherwise sanitizes or drops it.
 */
function beforeBreadcrumb(breadcrumb: SentryLikeBreadcrumb): SentryLikeBreadcrumb | null {
  try {
    if (!diagnosticsEnabled) return null
    return sanitizeBreadcrumb(breadcrumb)
  } catch {
    return null
  }
}

/**
 * Filter the SDK's default integrations down to a privacy-safe set. We remove
 * every integration that auto-captures potentially sensitive context:
 * breadcrumbs (http/console/navigation), device context PII, screenshots,
 * view hierarchy, user-interaction, and any replay integration.
 */
function filterIntegrations(defaults: { name: string }[]): { name: string }[] {
  const BLOCKED = [
    'Breadcrumbs',
    'HttpContext',
    'DeviceContext',
    'Screenshot',
    'ViewHierarchy',
    'UserInteraction',
    'Replay',
    'MobileReplay',
    'HttpClient',
    'ReactNativeErrorHandlers.console',
    'Console',
    'CaptureConsole',
    'ExpoConstants', // injects expo_constants context (session id, execution env)
    'ReactNativeInfo', // injects react_native_context (hermes/engine build details)
  ]
  return defaults.filter((i) => !BLOCKED.some((b) => i.name.toLowerCase().includes(b.toLowerCase())))
}

/**
 * Apply safe tags to the global scope. Only build metadata and derived generic
 * enums — never a URL, hostname, credential, or device name.
 */
function applySafeTags(): void {
  try {
    const meta = getSafeBuildMetadata()
    const scope = Sentry.getGlobalScope()
    scope.setTag('app.version', meta.appVersion)
    scope.setTag('app.build', meta.buildNumber)
    // Not 'platform': that is a reserved Sentry event field (javascript/cocoa/java),
    // so a tag of that name is shadowed by it and never becomes queryable.
    scope.setTag('app.platform', meta.platform)
    scope.setTag('os.version', meta.osVersion)
    scope.setTag('js.engine', meta.jsEngine)
    scope.setTag('environment', resolveEnvironment())
    if (meta.expoRuntimeVersion) scope.setTag('expo.runtime', meta.expoRuntimeVersion)
    if (meta.easUpdateId) scope.setTag('eas.update_id', meta.easUpdateId)
    if (meta.easChannel) scope.setTag('eas.channel', meta.easChannel)
    if (typeof meta.isEmbeddedUpdate === 'boolean') {
      scope.setTag('eas.embedded_update', String(meta.isEmbeddedUpdate))
    }
  } catch {
    // Tagging is best-effort; never block init.
  }
}

/**
 * The single, privacy-hardened Sentry.init() call — runs AT MOST ONCE per
 * process, unconditionally with respect to consent. Gated only by DSN +
 * environment. `startupConsent` decides `enableAutoSessionTracking` for the
 * life of this process (see module doc: that flag cannot be changed later).
 */
async function performInit(startupConsent: boolean): Promise<void> {
  Sentry.init({
    dsn: DSN,
    environment: resolveEnvironment(),
    release: getReleaseString(),
    dist: getSafeBuildMetadata().buildNumber,
    enabled: true,
    debug: SENTRY_DEBUG, // opt-in only: the SDK's native debug logger is very noisy

    // ---- Privacy hardening: disable everything that could capture content ----
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    attachStacktrace: true, // stack traces are scrubbed by our sanitizer
    enableCaptureFailedRequests: false,
    enableUserInteractionTracing: false,
    enableAutoPerformanceTracing: false,
    // A session is a start/end timestamp plus an ok/errored/crashed status —
    // no content, no PII — and it is the only source of crash-free rate and
    // release adoption. It is fixed at native-init time (see module doc), so
    // it reflects consent AT STARTUP, not later toggles this process.
    enableAutoSessionTracking: startupConsent,
    enableAutoConsoleLogs: false,
    enableWatchdogTerminationTracking: false,
    enableNativeNagger: false,

    // No Session Replay — sample rates pinned to zero as belt-and-suspenders.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // No performance tracing at all.
    tracesSampleRate: 0,
    sampleRate: ERROR_SAMPLE_RATE,
    maxBreadcrumbs: 20,

    // Strip risky default integrations; our hooks are the final guard.
    integrations: (defaults) => filterIntegrations(defaults),

    beforeSend: (event) => beforeSend(event as unknown as SentryLikeEvent) as never,
    beforeBreadcrumb: (breadcrumb) =>
      beforeBreadcrumb(breadcrumb as unknown as SentryLikeBreadcrumb) as never,
  })

  applySafeTags()
  sdkReady = true
  if (__DEV__) console.log('[sentry] SDK ready (consent gate still applies to passive capture)')
}

/**
 * Ensure the SDK is ready, initializing at most once. `consentNow` is only
 * consulted on the very first call (it decides the process-lifetime
 * `enableAutoSessionTracking` value) — later calls are no-ops once ready.
 * Never throws.
 */
async function ensureSdkReady(consentNow: boolean): Promise<boolean> {
  if (sdkReady) return true
  try {
    if (!isDsnConfigured()) {
      if (__DEV__) console.log('[sentry] init skipped: no DSN configured')
      return false
    }
    if (!environmentPermitsReporting()) {
      if (__DEV__) console.log('[sentry] init skipped: environment does not permit reporting')
      return false
    }
    await performInit(consentNow)
    return true
  } catch (err) {
    sdkReady = false
    if (__DEV__) console.log('[sentry] init failed:', err instanceof Error ? err.message : String(err))
    return false
  }
}

/**
 * React to the Anonymous Diagnostics consent setting — on mount (with the
 * hydrated value) and on every toggle. This is the single entry point the
 * settings UI / sync hook calls.
 *
 * Never closes or re-initializes the client: readiness and consent are
 * independent (see module doc). Enabling attaches the anonymous install id;
 * disabling clears it and stops passive capture via beforeSend/beforeBreadcrumb.
 */
export async function setAnonymousDiagnosticsEnabled(enabled: boolean): Promise<void> {
  try {
    const ready = await ensureSdkReady(enabled)
    if (!ready) {
      diagnosticsEnabled = false
      return
    }
    diagnosticsEnabled = enabled
    if (enabled) {
      const id = await getSentryInstallId()
      Sentry.getGlobalScope().setUser({ id })
    } else {
      Sentry.getGlobalScope().setUser(null)
      await clearSentryInstallId()
    }
  } catch (err) {
    diagnosticsEnabled = false
    if (__DEV__) console.log('[sentry] setAnonymousDiagnosticsEnabled failed:', err instanceof Error ? err.message : String(err))
  }
}

/** Current standing Anonymous Diagnostics consent state. */
export function isAnonymousDiagnosticsEnabled(): boolean {
  return diagnosticsEnabled
}

/**
 * Set the derived generic connection-mode tag. Callers pass a URL; this module
 * derives the coarse enum and NEVER retains the URL.
 */
export function setConnectionModeTag(url: string | null | undefined): void {
  if (!sdkReady) return
  try {
    const mode: ConnectionMode = deriveConnectionMode(url)
    Sentry.getGlobalScope().setTag('connection.mode', mode)
  } catch {
    // ignore
  }
}

/**
 * Explicitly capture an unexpected operational failure. Use for defects — NOT
 * for expected connection failures or user-cancelled flows. This is PASSIVE
 * capture (e.g. `RootErrorBoundary.componentDidCatch`): `beforeSend` drops it
 * unless standing consent is on. For an explicit, user-initiated report that
 * must go through regardless of consent, use `reportOneShot` instead.
 *
 * @returns the Sentry event id, or undefined if not captured/blocked.
 */
export function captureHandledError(
  error: unknown,
  context?: { tag?: string },
): string | undefined {
  if (!sdkReady) {
    if (__DEV__) console.log('[sentry] captureHandledError skipped: SDK not ready')
    return undefined
  }
  return doCaptureException(error, context)
}

/** The actual capture call, shared by captureHandledError and reportOneShot.
 * Callers are responsible for ensuring the SDK is ready first.
 * `oneShot: true` tags the event so `beforeSend` lets it through exactly once
 * regardless of standing consent. */
function doCaptureException(
  error: unknown,
  context?: { tag?: string },
  oneShot?: boolean,
): string | undefined {
  try {
    const normalized = normalizeError(error)
    const safeError = new Error(normalized.message)
    safeError.name = normalized.name
    if (normalized.stack) safeError.stack = normalized.stack

    const eventId = Sentry.captureException(safeError, (scope) => {
      if (context?.tag && isSafeEnumToken(context.tag)) {
        scope.setTag('context', context.tag)
      }
      if (oneShot) {
        scope.setTag(ONE_SHOT_TAG, '1')
      }
      return scope
    })
    if (__DEV__) console.log('[sentry] captureException queued, eventId:', eventId)
    return eventId
  } catch (err) {
    if (__DEV__) console.log('[sentry] captureException failed:', err instanceof Error ? err.message : String(err))
    return undefined
  }
}

/**
 * Send exactly ONE sanitized crash report, regardless of the standing
 * Anonymous Diagnostics consent setting. This is a single, explicit,
 * user-initiated action (e.g. tapping "Report" on the crash screen) — the
 * same category as the Help & Feedback flow, which also works independent of
 * the consent toggle. It never reads or writes the persisted consent setting.
 *
 * The event is tagged so `beforeSend` lets exactly this one report through
 * even while standing consent is off; the SDK itself is never torn down —
 * it's already up (see module doc: readiness is unconditional).
 *
 * - Still requires a DSN and an environment that permits reporting — those
 *   gates are unconditional and are not something a UI action can bypass.
 *
 * @returns the Sentry event id, or undefined if the report could not be sent
 *          (no DSN, environment doesn't permit it, or the capture failed).
 */
export async function reportOneShot(
  error: unknown,
  context?: { tag?: string },
): Promise<string | undefined> {
  const ready = await ensureSdkReady(diagnosticsEnabled)
  if (!ready) {
    if (__DEV__) console.log('[sentry] reportOneShot skipped: SDK not ready (no DSN or environment does not permit reporting)')
    return undefined
  }
  const eventId = doCaptureException(error, context, /* oneShot */ true)
  await Sentry.flush()
  return eventId
}

/**
 * Capture a safe diagnostic message. `message` MUST be a safe enum token
 * (snake/dot-cased, no free-form content) — anything else is rejected.
 */
export function captureSafeMessage(message: string): string | undefined {
  if (!sdkReady) return undefined
  if (!isSafeEnumToken(message)) return undefined
  try {
    return Sentry.captureMessage(message, 'info')
  } catch {
    return undefined
  }
}

/**
 * Add a safe lifecycle breadcrumb. `event` MUST be a safe enum token. Any
 * `data` is sanitized. This is the ONLY sanctioned way to add breadcrumbs.
 */
export function addSafeBreadcrumb(event: string, data?: Record<string, unknown>): void {
  if (!sdkReady) return
  if (!isSafeEnumToken(event)) return
  try {
    Sentry.addBreadcrumb({
      category: 'app.lifecycle',
      message: event,
      level: 'info',
      data: data && typeof data === 'object' ? (sanitizeBreadcrumb({ category: 'app', data })?.data as Record<string, unknown>) : undefined,
    })
  } catch {
    // ignore
  }
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Decode a base64 string to raw bytes. Hermes has no built-in atob. */
function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/=+$/, '')
  const bytes: number[] = []
  let buffer = 0
  let bits = 0
  for (const char of clean) {
    const value = BASE64_CHARS.indexOf(char)
    if (value === -1) continue
    buffer = (buffer << 6) | value
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
    }
  }
  return new Uint8Array(bytes)
}

/** Read a feedback screenshot off disk into a Sentry attachment. */
async function loadAttachment(attachment: {
  uri: string
  mimeType: string
  filename?: string
}): Promise<{ data: Uint8Array; filename: string; contentType: string }> {
  const base64 = await FileSystem.readAsStringAsync(attachment.uri, { encoding: FileSystem.EncodingType.Base64 })
  return {
    data: base64ToBytes(base64),
    filename: attachment.filename || 'screenshot.jpg',
    contentType: attachment.mimeType,
  }
}

/**
 * Submit user feedback via Sentry's User Feedback API. Feedback works
 * regardless of standing Anonymous Diagnostics consent — this makes "explicit
 * user action always works" a consistent rule across the app (crash report
 * button + feedback form behave the same way). Unlike `reportOneShot`, this
 * needs no per-call authorization tag: `captureFeedback` produces a
 * `type: "feedback"` event, and the SDK only invokes `beforeSend` for events
 * with no `type` — feedback never reaches our consent gate at all (verified
 * against `@sentry/core`'s `isErrorEvent`/`processBeforeSend`).
 *
 * The screenshot, if provided, is uploaded as a raw attachment alongside the
 * feedback event — attachments never touch `beforeSend`, but the screenshot is
 * already user-picked and stripped of EXIF before it reaches here.
 *
 * - Still requires a DSN and an environment that permits reporting — those
 *   gates are unconditional and are not something a UI action can bypass.
 *
 * @returns the feedback event id when submitted, or undefined if the feedback
 *          could not be sent (no DSN, environment doesn't permit it, or the
 *          capture failed).
 */
export async function submitFeedbackViaSentry(params: {
  message: string
  email?: string
  category?: string
  attachment?: { uri: string; mimeType: string; filename?: string }
}): Promise<string | undefined> {
  const message = params.message?.trim()
  if (!message) return undefined

  const ready = await ensureSdkReady(diagnosticsEnabled)
  if (!ready) {
    if (__DEV__) console.log('[sentry] submitFeedbackViaSentry skipped: SDK not ready (no DSN or environment does not permit reporting)')
    return undefined
  }

  try {
    const attachments = params.attachment ? [await loadAttachment(params.attachment)] : undefined
    const id = Sentry.captureFeedback(
      {
        message,
        email: params.email?.trim() || undefined,
        source: 'app.feedback_form',
        tags:
          params.category && isSafeEnumToken(params.category)
            ? { 'feedback.category': params.category }
            : undefined,
      },
      attachments ? { attachments } : undefined,
    )

    await Sentry.flush()
    return typeof id === 'string' ? id : undefined
  } catch {
    return undefined
  }
}

/**
 * The id of the last event Sentry sent, if any. Opaque, non-identifying — safe
 * to surface in diagnostics so a user can reference a specific crash. Returns
 * undefined when reporting is inactive or nothing has been sent.
 */
export function getLastEventId(): string | undefined {
  if (!sdkReady) return undefined
  try {
    return Sentry.lastEventId() ?? undefined
  } catch {
    return undefined
  }
}

/** The Sentry wrap HOC for the root component (re-exported for a single import site). */
export const wrap = Sentry.wrap

/** The Sentry ErrorBoundary (used inside our RootErrorBoundary fallback path). */
export const SentryErrorBoundary = Sentry.ErrorBoundary
