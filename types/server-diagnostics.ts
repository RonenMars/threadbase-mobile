/**
 * Streamer diagnostics contract (C6) — mirrors tb-streamer
 * `src/services/diagnostics/diagnostics.ts` contractVersion 1.
 * Field names must stay in lockstep with the HTTP response.
 */

export const SERVER_DIAGNOSTICS_CONTRACT_VERSION = 1

export type CheckStatus = 'ok' | 'degraded' | 'failed' | 'unknown'

export type RemediationCode =
  | 'PROVIDER_NOT_INSTALLED'
  | 'PROVIDER_VERSION_UNVERIFIED'
  | 'DB_UNAVAILABLE'
  | 'DB_MIGRATION_PENDING'
  | 'PTY_UNAVAILABLE'
  | 'CACHE_DEGRADED'
  | 'CLOCK_SKEWED'
  | 'FS_SCOPE_MISSING'
  | 'NONE'

export interface ServerDiagnosticCheck {
  id: string
  status: CheckStatus
  summary: string
  remediation: RemediationCode
  detail?: Record<string, string | number | boolean | null>
}

export interface ServerDiagnosticsReport {
  contractVersion: number
  generatedAt: string
  overall: CheckStatus
  checks: ServerDiagnosticCheck[]
}

const CHECK_STATUSES: ReadonlySet<string> = new Set(['ok', 'degraded', 'failed', 'unknown'])

const REMEDIATION_CODES: ReadonlySet<string> = new Set([
  'PROVIDER_NOT_INSTALLED',
  'PROVIDER_VERSION_UNVERIFIED',
  'DB_UNAVAILABLE',
  'DB_MIGRATION_PENDING',
  'PTY_UNAVAILABLE',
  'CACHE_DEGRADED',
  'CLOCK_SKEWED',
  'FS_SCOPE_MISSING',
  'NONE',
])

function isRecord(value: object): value is Record<string, string | number | boolean | null | object | object[]> {
  return !Array.isArray(value)
}

function parseDetail(
  value: string | number | boolean | null | object | object[] | undefined,
): Record<string, string | number | boolean | null> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const out: Record<string, string | number | boolean | null> = {}
  for (const [k, v] of Object.entries(value)) {
    if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function parseCheck(raw: object): ServerDiagnosticCheck | null {
  if (!isRecord(raw)) return null
  const id = raw.id
  const status = raw.status
  const summary = raw.summary
  const remediation = raw.remediation
  if (typeof id !== 'string' || typeof summary !== 'string') return null
  if (typeof status !== 'string' || !CHECK_STATUSES.has(status)) return null
  if (typeof remediation !== 'string' || !REMEDIATION_CODES.has(remediation)) return null
  return {
    id,
    status: status as CheckStatus,
    summary,
    remediation: remediation as RemediationCode,
    detail: parseDetail(raw.detail),
  }
}

/** Narrow a JSON body to the diagnostics report, or null if unusable. */
export function parseServerDiagnosticsReport(body: object): ServerDiagnosticsReport | null {
  if (!isRecord(body)) return null
  const contractVersion = body.contractVersion
  const generatedAt = body.generatedAt
  const overall = body.overall
  const checksRaw = body.checks
  if (typeof contractVersion !== 'number') return null
  if (typeof generatedAt !== 'string') return null
  if (typeof overall !== 'string' || !CHECK_STATUSES.has(overall)) return null
  if (!Array.isArray(checksRaw)) return null

  const checks: ServerDiagnosticCheck[] = []
  for (const item of checksRaw) {
    if (!item || typeof item !== 'object') continue
    const parsed = parseCheck(item)
    if (parsed) checks.push(parsed)
  }

  return {
    contractVersion,
    generatedAt,
    overall: overall as CheckStatus,
    checks,
  }
}
