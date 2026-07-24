import { createApiForServer } from '@/services/api-client'
import {
  parseServerDiagnosticsReport,
  SERVER_DIAGNOSTICS_CONTRACT_VERSION,
  type RemediationCode,
  type ServerDiagnosticsReport,
} from '@/types/server-diagnostics'

export class ServerDiagnosticsParseError extends Error {
  constructor() {
    super('Server returned an unrecognized diagnostics payload')
    this.name = 'ServerDiagnosticsParseError'
  }
}

export async function fetchServerDiagnostics(
  serverId: string,
  signal?: AbortSignal,
): Promise<ServerDiagnosticsReport> {
  const api = createApiForServer(serverId)
  const body = await api.get<object>('/api/diagnostics', { signal })
  const report = parseServerDiagnosticsReport(body)
  if (!report) throw new ServerDiagnosticsParseError()
  return report
}

export function isSupportedDiagnosticsContract(report: ServerDiagnosticsReport): boolean {
  return report.contractVersion === SERVER_DIAGNOSTICS_CONTRACT_VERSION
}

/** Remediation codes that warrant a user-facing action card (not NONE). */
export function needsRemediation(code: RemediationCode): boolean {
  return code !== 'NONE'
}

/**
 * Sanitized plain-text report for copy/share. Uses only allowlisted fields
 * from the contract — never invents server URLs or credentials.
 */
export function serverDiagnosticsToText(
  serverLabel: string,
  report: ServerDiagnosticsReport,
): string {
  const lines: string[] = [
    `Threadbase server health`,
    `Server: ${serverLabel}`,
    `Contract: v${report.contractVersion}`,
    `Generated: ${report.generatedAt}`,
    `Overall: ${report.overall}`,
    '',
  ]
  for (const check of report.checks) {
    lines.push(`[${check.status}] ${check.id}`)
    lines.push(`  ${check.summary}`)
    lines.push(`  remediation: ${check.remediation}`)
    if (check.detail) {
      for (const [k, v] of Object.entries(check.detail)) {
        lines.push(`  ${k}: ${v === null ? 'null' : String(v)}`)
      }
    }
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}
