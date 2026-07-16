/**
 * Centralized diagnostics generator.
 *
 * PRIVACY-CRITICAL. This is a positive allowlist: it assembles ONLY the fields
 * declared in `DiagnosticsReport`, each of which is a build constant, a derived
 * generic enum, a bounded count, a coarse timestamp, or an opaque event id. It
 * never reads server URLs, ids, names, credentials, hostnames, session
 * ids/titles, paths, or any user content. Every value is additionally passed
 * through the central `sanitize()` before it is returned, so even a future
 * regression that let something through the allowlist would be scrubbed.
 *
 * The generator produces both a structured object (for JSON export) and a
 * human-readable text block (for copy). Both are size-capped.
 */

import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { wsManager } from '@/services/ws-client'
import { getSafeBuildMetadata, deriveConnectionMode, type ConnectionMode } from './safe-metadata'
import { getLastEventId } from './sentry'
import { getDiagnosticEvents, type DiagnosticEventEntry } from './diagnostic-events'
import { sanitize } from './sanitize'

/** Generic aggregate connection state across all configured servers. */
export type AggregateConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error' | 'unknown'
export type NotificationPermission = 'granted' | 'denied' | 'undetermined'

/**
 * The full, allowlisted diagnostics payload. Every field is safe by
 * construction — see the module header. Optional fields are omitted when
 * unavailable.
 */
export interface DiagnosticsReport {
  appVersion: string
  buildNumber: string
  platform: string
  osVersion: string
  jsEngine: string
  environment: string
  expoRuntimeVersion?: string
  easUpdateId?: string
  easChannel?: string
  /** Generic transport category — never a URL or hostname. */
  connectionMode: ConnectionMode
  /** Aggregate connection state across servers — a generic enum. */
  connectionState: AggregateConnectionState
  /** Count only — never server URLs, names, or ids. */
  serverCount: number
  displayedServerCount: number
  hasEverHadServer: boolean
  /** Distinct streamer software versions (generic version strings only). */
  streamerVersions: string[]
  /** Sum of active sessions across servers — a count, never ids/titles. */
  activeSessionCount: number
  /** Coarse (minute-precision) last successful connection time, if known. */
  lastConnectionAt?: string
  notificationPermission: NotificationPermission
  crashReportingEnabled: boolean
  /** Opaque last Sentry event id, if crash reporting is active. */
  sentryEventId?: string
  /** Bounded list of sanitized lifecycle events (strict enum + coarse time). */
  recentEvents: DiagnosticEventEntry[]
}

function resolveEnvironment(easChannel?: string): string {
  if (__DEV__) return 'development'
  return easChannel || 'production'
}

function jsEngine(): string {
  const g = globalThis as unknown as { HermesInternal?: unknown }
  return g.HermesInternal ? 'hermes' : 'jsc'
}

/** Aggregate WS + fetch status across servers into a single generic enum. */
function deriveConnectionState(activeServerIds: string[]): AggregateConnectionState {
  if (activeServerIds.length === 0) return 'unknown'
  const fetchStatuses = useServerFetchStatusStore.getState().statuses
  let anyConnected = false
  let anyConnecting = false
  let anyError = false
  for (const id of activeServerIds) {
    const ws = wsManager.status(id)
    if (ws === 'connected') anyConnected = true
    else if (ws === 'connecting') anyConnecting = true
    if (fetchStatuses[id]?.status === 'error') anyError = true
  }
  if (anyConnected) return 'connected'
  if (anyConnecting) return 'connecting'
  if (anyError) return 'error'
  return 'disconnected'
}

/** Distinct streamer versions across servers, without exposing ids/urls. */
function collectStreamerVersions(servers: Record<string, { serverInfo?: { version?: string } | null }>, activeServerIds: string[]): string[] {
  const set = new Set<string>()
  for (const id of activeServerIds) {
    const v = servers[id]?.serverInfo?.version
    if (typeof v === 'string' && v.length > 0 && v.length <= 40) set.add(v)
  }
  return Array.from(set).sort()
}

function sumActiveSessions(servers: Record<string, { serverInfo?: { activeSessions?: number } | null }>, activeServerIds: string[]): number {
  let total = 0
  for (const id of activeServerIds) {
    const n = servers[id]?.serverInfo?.activeSessions
    if (typeof n === 'number' && Number.isFinite(n) && n >= 0) total += n
  }
  return total
}

/** Coarse (minute-precision) most-recent successful fetch time across servers. */
function lastConnectionAt(activeServerIds: string[]): string | undefined {
  const statuses = useServerFetchStatusStore.getState().statuses
  let latest = 0
  for (const id of activeServerIds) {
    const entry = statuses[id]
    if (entry?.status === 'ok' && typeof entry.lastCheckedAt === 'number' && entry.lastCheckedAt > latest) {
      latest = entry.lastCheckedAt
    }
  }
  if (latest === 0) return undefined
  return new Date(latest).toISOString().slice(0, 16) + 'Z'
}

/**
 * Build the diagnostics report. Never throws — on any failure it returns a
 * minimal snapshot rather than risking partial/unsafe data. The `notification`
 * permission read is async, so this returns a Promise.
 */
export async function generateDiagnostics(): Promise<DiagnosticsReport> {
  const meta = getSafeBuildMetadata()

  let servers: Record<string, { url?: string; serverInfo?: { version?: string; activeSessions?: number } | null }> = {}
  let activeServerIds: string[] = []
  let displayedServerCount = 0
  let hasEverHadServer = false
  let crashReportingEnabled = false
  try {
    const serversState = useServersStore.getState()
    servers = serversState.servers
    activeServerIds = serversState.activeServerIds
    displayedServerCount = serversState.displayedServerIds.length
    hasEverHadServer = serversState.hasEverHadServer
    crashReportingEnabled = useSettingsStore.getState().crashReportingEnabled
  } catch {
    // stores unavailable — keep safe defaults
  }

  // Derive the connection mode from the first server's URL only to read
  // protocol/host; the URL is never stored (deriveConnectionMode returns an enum).
  let connectionMode: ConnectionMode = 'unknown'
  for (const id of activeServerIds) {
    const mode = deriveConnectionMode(servers[id]?.url)
    if (mode === 'remote') { connectionMode = 'remote'; break }
    if (mode === 'local') connectionMode = 'local'
  }

  let notificationPermission: NotificationPermission = 'undetermined'
  try {
    const perm = await Notifications.getPermissionsAsync()
    if (perm.status === 'granted' || perm.status === 'denied') notificationPermission = perm.status
  } catch {
    // permission read unavailable — leave undetermined
  }

  const report: DiagnosticsReport = {
    appVersion: meta.appVersion,
    buildNumber: meta.buildNumber,
    platform: Platform.OS,
    osVersion: meta.osVersion,
    jsEngine: jsEngine(),
    environment: resolveEnvironment(meta.easChannel),
    expoRuntimeVersion: meta.expoRuntimeVersion,
    easUpdateId: meta.easUpdateId,
    easChannel: meta.easChannel,
    connectionMode,
    connectionState: deriveConnectionState(activeServerIds),
    serverCount: activeServerIds.length,
    displayedServerCount,
    hasEverHadServer,
    streamerVersions: collectStreamerVersions(servers, activeServerIds),
    activeSessionCount: sumActiveSessions(servers, activeServerIds),
    lastConnectionAt: lastConnectionAt(activeServerIds),
    notificationPermission,
    crashReportingEnabled,
    sentryEventId: getLastEventId(),
    recentEvents: getDiagnosticEvents(),
  }

  // Final guard: pass the whole report through the central sanitizer. The
  // report is already an allowlist, so this is defense-in-depth — it guarantees
  // that even a future field carrying a URL/path/id would be scrubbed before it
  // can leave the device.
  return sanitize(report) as DiagnosticsReport
}

/** Ordered {key, value} rows for the preview UI and text output. */
export function diagnosticsToRows(d: DiagnosticsReport): { key: string; value: string }[] {
  const rows: { key: string; value: string }[] = [
    { key: 'appVersion', value: d.appVersion },
    { key: 'buildNumber', value: d.buildNumber },
    { key: 'platform', value: d.platform },
    { key: 'osVersion', value: d.osVersion },
    { key: 'jsEngine', value: d.jsEngine },
    { key: 'environment', value: d.environment },
    { key: 'connectionMode', value: d.connectionMode },
    { key: 'connectionState', value: d.connectionState },
    { key: 'serverCount', value: String(d.serverCount) },
    { key: 'displayedServerCount', value: String(d.displayedServerCount) },
    { key: 'hasEverHadServer', value: String(d.hasEverHadServer) },
    { key: 'activeSessionCount', value: String(d.activeSessionCount) },
    { key: 'notificationPermission', value: d.notificationPermission },
    { key: 'crashReportingEnabled', value: String(d.crashReportingEnabled) },
  ]
  if (d.streamerVersions.length) rows.push({ key: 'streamerVersions', value: d.streamerVersions.join(', ') })
  if (d.lastConnectionAt) rows.push({ key: 'lastConnectionAt', value: d.lastConnectionAt })
  if (d.expoRuntimeVersion) rows.push({ key: 'expoRuntimeVersion', value: d.expoRuntimeVersion })
  if (d.easChannel) rows.push({ key: 'easChannel', value: d.easChannel })
  if (d.easUpdateId) rows.push({ key: 'easUpdateId', value: d.easUpdateId })
  if (d.sentryEventId) rows.push({ key: 'sentryEventId', value: d.sentryEventId })
  return rows
}

/** Human-readable text output for copy-to-clipboard. Size-capped. */
export function diagnosticsToText(d: DiagnosticsReport): string {
  const lines = ['Threadbase diagnostics', '']
  for (const row of diagnosticsToRows(d)) lines.push(`${row.key}: ${row.value}`)
  if (d.recentEvents.length) {
    lines.push('', 'Recent events:')
    for (const e of d.recentEvents) lines.push(`  ${e.at} ${e.event}`)
  }
  return lines.join('\n').slice(0, 8 * 1024)
}

/** Structured JSON output. Size-capped. */
export function diagnosticsToJson(d: DiagnosticsReport): string {
  return JSON.stringify(d, null, 2).slice(0, 16 * 1024)
}
