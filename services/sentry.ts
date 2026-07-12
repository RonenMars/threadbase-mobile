/**
 * Privacy-first Sentry crash-reporting service.
 *
 * Single module that owns all Sentry SDK interaction. The rest of the app
 * never imports `@sentry/react-native` directly. Design invariants:
 *
 *  - Opt-in only. Sentry is NEVER initialized unless the user has enabled crash
 *    reporting AND a DSN is configured AND the build environment permits it.
 *  - Every outbound event and breadcrumb passes through the centralized
 *    sanitizer (`services/sanitize.ts`). Anything that cannot be confidently
 *    sanitized is dropped.
 *  - Disabling is immediate: `disableCrashReporting()` closes the client so no
 *    further events are transmitted, and clears the anonymous install id.
 *  - Failures fail closed and never block app startup or leak raw data.
 *
 * See `docs/sentry-setup.md` for configuration and required EAS secrets.
 */

import Constants from 'expo-constants'
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

/** Conservative error sampling. We are not doing performance tracing at all. */
const ERROR_SAMPLE_RATE = 1.0

let initialized = false

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
 * beforeSend hook — the last line of defense. Routes every event through the
 * allowlist sanitizer and drops anything that can't be sanitized.
 */
function beforeSend(event: SentryLikeEvent): SentryLikeEvent | null {
  try {
    return sanitizeEvent(event)
  } catch {
    return null // fail closed
  }
}

/** beforeBreadcrumb hook — sanitizes or drops each breadcrumb. */
function beforeBreadcrumb(breadcrumb: SentryLikeBreadcrumb): SentryLikeBreadcrumb | null {
  try {
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
    'ExpoContext', // may include device/session identifiers
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
    scope.setTag('platform', meta.platform)
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
 * Initialize Sentry — ONLY when consent is granted, a DSN is configured, and
 * the environment permits reporting. Idempotent. Never throws; a failure here
 * must never crash or block app startup.
 *
 * @param consentGranted current value of the crash-reporting consent setting.
 */
export async function initCrashReporting(consentGranted: boolean): Promise<boolean> {
  try {
    if (initialized) return true
    if (!consentGranted) return false
    if (!isDsnConfigured()) return false
    if (!environmentPermitsReporting()) return false

    Sentry.init({
      dsn: DSN,
      environment: resolveEnvironment(),
      release: getReleaseString(),
      dist: getSafeBuildMetadata().buildNumber,
      enabled: true,

      // ---- Privacy hardening: disable everything that could capture content ----
      sendDefaultPii: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
      attachStacktrace: true, // stack traces are scrubbed by our sanitizer
      enableCaptureFailedRequests: false,
      enableUserInteractionTracing: false,
      enableAutoPerformanceTracing: false,
      enableAutoSessionTracking: false,
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

    // Anonymous, non-network install id for issue grouping. No other user data.
    try {
      const id = await getSentryInstallId()
      Sentry.getGlobalScope().setUser({ id })
    } catch {
      // No id is fine — grouping still works via stack + release.
    }

    applySafeTags()
    initialized = true
    return true
  } catch {
    // Never let crash-reporting setup crash the app.
    initialized = false
    return false
  }
}

/**
 * Disable crash reporting immediately. Closes the client so no further events
 * are transmitted and clears the anonymous install id. Safe to call when never
 * initialized.
 */
export async function disableCrashReporting(): Promise<void> {
  try {
    if (initialized) {
      Sentry.getGlobalScope().setUser(null)
      await Sentry.close()
    }
  } catch {
    // ignore
  } finally {
    initialized = false
  }
  await clearSentryInstallId()
}

/**
 * React to a consent toggle at runtime. Enabling initializes; disabling closes
 * the client. This is the single entry point the settings UI calls.
 */
export async function setCrashReportingEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await initCrashReporting(true)
  } else {
    await disableCrashReporting()
  }
}

export function isCrashReportingActive(): boolean {
  return initialized
}

/**
 * Set the derived generic connection-mode tag. Callers pass a URL; this module
 * derives the coarse enum and NEVER retains the URL.
 */
export function setConnectionModeTag(url: string | null | undefined): void {
  if (!initialized) return
  try {
    const mode: ConnectionMode = deriveConnectionMode(url)
    Sentry.getGlobalScope().setTag('connection.mode', mode)
  } catch {
    // ignore
  }
}

/**
 * Explicitly capture an unexpected operational failure. Use for defects — NOT
 * for expected connection failures or user-cancelled flows. The error is
 * normalized+scrubbed before capture; a safe enum context tag may be attached.
 *
 * @returns the Sentry event id, or undefined if not captured.
 */
export function captureHandledError(
  error: unknown,
  context?: { tag?: string },
): string | undefined {
  if (!initialized) return undefined
  try {
    const normalized = normalizeError(error)
    const safeError = new Error(normalized.message)
    safeError.name = normalized.name
    if (normalized.stack) safeError.stack = normalized.stack

    return Sentry.captureException(safeError, (scope) => {
      if (context?.tag && isSafeEnumToken(context.tag)) {
        scope.setTag('context', context.tag)
      }
      return scope
    })
  } catch {
    return undefined
  }
}

/**
 * Capture a safe diagnostic message. `message` MUST be a safe enum token
 * (snake/dot-cased, no free-form content) — anything else is rejected.
 */
export function captureSafeMessage(message: string): string | undefined {
  if (!initialized) return undefined
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
  if (!initialized) return
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

/**
 * Submit user feedback via Sentry's User Feedback API. Only works when Sentry
 * is active (consent on + DSN). The resulting feedback event passes through
 * `beforeSend` → `sanitizeFeedbackEvent`, which lets the user-authored message
 * and reply email through (they explicitly chose to submit them) while still
 * stripping everything else.
 *
 * @returns the feedback event id when submitted, or undefined if Sentry is not
 *          active (caller should fall back to email/copy).
 */
export function submitFeedbackViaSentry(params: {
  message: string
  email?: string
  category?: string
}): string | undefined {
  if (!initialized) return undefined
  const message = params.message?.trim()
  if (!message) return undefined
  try {
    const id = Sentry.captureFeedback({
      message,
      email: params.email?.trim() || undefined,
      source: 'app.feedback_form',
      tags:
        params.category && isSafeEnumToken(params.category)
          ? { 'feedback.category': params.category }
          : undefined,
    })
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
  if (!initialized) return undefined
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
