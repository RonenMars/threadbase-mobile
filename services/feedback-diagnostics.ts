/**
 * Builds the allowlisted diagnostics payload shown in the feedback preview and
 * attached (only on opt-in) to a submission.
 *
 * PRIVACY-CRITICAL. This is a positive allowlist: it assembles ONLY the fields
 * declared in `FeedbackDiagnostics`, each of which is a build constant or a
 * derived generic enum. It never reads server URLs, names, ids, session data,
 * paths, or any user content. The connection mode is derived from the active
 * server's URL via `deriveConnectionMode`, which returns only a generic enum
 * and never retains the URL.
 */

import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import { getSafeBuildMetadata, deriveConnectionMode } from './safe-metadata'
import type { FeedbackDiagnostics } from '@/types/feedback'

/** Resolve the environment label the same way the Sentry service does. */
function resolveEnvironment(easChannel?: string): string {
  if (__DEV__) return 'development'
  return easChannel || 'production'
}

/**
 * Derive the generic connection mode across configured servers without ever
 * exposing a URL. If any active server resolves to `remote`, report `remote`;
 * else if any resolves to `local`, report `local`; else `unknown`. Only the
 * enum is returned.
 */
function deriveAggregateConnectionMode(): FeedbackDiagnostics['connectionMode'] {
  try {
    const { servers, activeServerIds } = useServersStore.getState()
    let sawLocal = false
    for (const id of activeServerIds) {
      const url = servers[id]?.url
      const mode = deriveConnectionMode(url)
      if (mode === 'remote') return 'remote'
      if (mode === 'local') sawLocal = true
    }
    return sawLocal ? 'local' : 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * Build the safe diagnostics snapshot. Never throws — on any failure it returns
 * a minimal snapshot rather than risking partial/unsafe data.
 */
export function buildFeedbackDiagnostics(): FeedbackDiagnostics {
  const meta = getSafeBuildMetadata()
  let serverCount = 0
  let crashReportingEnabled = false
  try {
    serverCount = useServersStore.getState().activeServerIds.length
    crashReportingEnabled = useSettingsStore.getState().crashReportingEnabled
  } catch {
    // stores unavailable — keep the safe defaults
  }

  return {
    appVersion: meta.appVersion,
    buildNumber: meta.buildNumber,
    platform: meta.platform,
    osVersion: meta.osVersion,
    jsEngine: meta.jsEngine,
    environment: resolveEnvironment(meta.easChannel),
    expoRuntimeVersion: meta.expoRuntimeVersion,
    easUpdateId: meta.easUpdateId,
    easChannel: meta.easChannel,
    connectionMode: deriveAggregateConnectionMode(),
    serverCount,
    crashReportingEnabled,
  }
}

/**
 * Render diagnostics as an ordered list of {label, value} rows for the preview
 * UI. Optional fields are omitted when absent. Values are always primitives.
 */
export function diagnosticsToRows(d: FeedbackDiagnostics): { key: string; value: string }[] {
  const rows: { key: string; value: string }[] = [
    { key: 'appVersion', value: d.appVersion },
    { key: 'buildNumber', value: d.buildNumber },
    { key: 'platform', value: d.platform },
    { key: 'osVersion', value: d.osVersion },
    { key: 'jsEngine', value: d.jsEngine },
    { key: 'environment', value: d.environment },
    { key: 'connectionMode', value: d.connectionMode },
    { key: 'serverCount', value: String(d.serverCount) },
    { key: 'crashReportingEnabled', value: String(d.crashReportingEnabled) },
  ]
  if (d.expoRuntimeVersion) rows.push({ key: 'expoRuntimeVersion', value: d.expoRuntimeVersion })
  if (d.easChannel) rows.push({ key: 'easChannel', value: d.easChannel })
  if (d.easUpdateId) rows.push({ key: 'easUpdateId', value: d.easUpdateId })
  return rows
}
