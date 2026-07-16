/**
 * Safe, non-identifying metadata shared by crash reporting (Sentry tags) and
 * diagnostics (Phase 3). Every value here is either a build constant or a
 * derived generic enum — nothing that can identify a user, device, server, or
 * session. See `services/sanitize.ts` for the redaction layer that guards
 * against accidental content; this module is the *positive* allowlist of what
 * we deliberately expose.
 */

import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Updates from 'expo-updates'

/**
 * Generic connection-transport category, derived at capture time from a server
 * URL WITHOUT storing or returning the URL itself. This is the only safe way
 * to expose "how is the user connected" — never the address.
 *
 * - `local`  — plaintext http and/or a private/LAN/loopback/.local host
 * - `remote` — https to a public host (tunnel, cloud, remote box)
 * - `unknown`— could not classify
 */
export type ConnectionMode = 'local' | 'remote' | 'unknown'

const PRIVATE_HOST_PATTERNS: readonly RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0 – 172.31.255.255
  /^169\.254\./, // link-local
  /\.local$/i, // mDNS
  /^\[::1\]$/, // IPv6 loopback
  /^\[?fe80:/i, // IPv6 link-local
  /^\[?fd[0-9a-f]{2}:/i, // IPv6 unique-local
]

/**
 * Derive a generic connection mode from a URL string. The URL is parsed only to
 * read its protocol and hostname; NEITHER is retained or returned. Returns
 * `unknown` on any parse failure (fail closed — never echo the raw URL).
 */
export function deriveConnectionMode(url: string | null | undefined): ConnectionMode {
  if (!url || typeof url !== 'string') return 'unknown'
  try {
    const parsed = new URL(url)
    const host = parsed.hostname
    const isPrivateHost = PRIVATE_HOST_PATTERNS.some((re) => re.test(host))
    const isHttps = parsed.protocol === 'https:' || parsed.protocol === 'wss:'
    if (isPrivateHost || parsed.protocol === 'http:' || parsed.protocol === 'ws:') {
      // Plaintext or a private/LAN host reads as a local connection.
      if (isPrivateHost) return 'local'
      if (!isHttps) return 'local'
    }
    if (isHttps) return 'remote'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

export interface SafeBuildMetadata {
  appVersion: string
  buildNumber: string
  platform: string
  osVersion: string
  jsEngine: string
  expoRuntimeVersion?: string
  easUpdateId?: string
  easChannel?: string
  isEmbeddedUpdate?: boolean
}

function coerceString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

/** OS version as reported by RN. Never includes a device name. */
function osVersion(): string {
  const v = Platform.Version
  return typeof v === 'string' ? v : String(v)
}

/** Detected JS engine, safe generic string. */
function jsEngine(): string {
  // Hermes exposes a global; otherwise assume JSC.
  const g = globalThis as unknown as { HermesInternal?: unknown }
  return g.HermesInternal ? 'hermes' : 'jsc'
}

/**
 * Build safe build/runtime metadata. Reads only build constants and EAS Update
 * identifiers (which are opaque ids, not URLs or content). Never throws.
 */
export function getSafeBuildMetadata(): SafeBuildMetadata {
  const cfg = Constants.expoConfig
  const appVersion = coerceString(cfg?.version) ?? '0.0.0'
  const buildNumber =
    Platform.OS === 'ios'
      ? coerceString(cfg?.ios?.buildNumber) ?? '0'
      : cfg?.android?.versionCode != null
        ? String(cfg.android.versionCode)
        : '0'

  const meta: SafeBuildMetadata = {
    appVersion,
    buildNumber,
    platform: Platform.OS,
    osVersion: osVersion(),
    jsEngine: jsEngine(),
  }

  try {
    // expo-updates values are opaque ids / channel names — safe, non-identifying.
    if (typeof Updates.runtimeVersion === 'string') meta.expoRuntimeVersion = Updates.runtimeVersion
    if (typeof Updates.updateId === 'string' && Updates.updateId) meta.easUpdateId = Updates.updateId
    if (typeof Updates.channel === 'string' && Updates.channel) meta.easChannel = Updates.channel
    if (typeof Updates.isEmbeddedLaunch === 'boolean') meta.isEmbeddedUpdate = Updates.isEmbeddedLaunch
  } catch {
    // expo-updates unavailable (e.g. dev client / tests) — omit those fields.
  }

  return meta
}

/**
 * Sentry release string in the conventional `name@version+build` form. Contains
 * only the public package name and build metadata.
 */
export function getReleaseString(): string {
  const { appVersion, buildNumber } = getSafeBuildMetadata()
  return `threadbase-mobile@${appVersion}+${buildNumber}`
}
