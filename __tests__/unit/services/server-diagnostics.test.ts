import {
  parseServerDiagnosticsReport,
  SERVER_DIAGNOSTICS_CONTRACT_VERSION,
} from '@/types/server-diagnostics'
import {
  isSupportedDiagnosticsContract,
  needsRemediation,
  serverDiagnosticsToText,
} from '@/services/server-diagnostics'

describe('parseServerDiagnosticsReport', () => {
  const valid = {
    contractVersion: 1,
    generatedAt: '2026-07-24T12:00:00.000Z',
    overall: 'degraded',
    checks: [
      {
        id: 'streamer',
        status: 'ok',
        summary: 'Streamer is running.',
        remediation: 'NONE',
        detail: { version: '1.0.0', uptimeSeconds: 12 },
      },
      {
        id: 'cache',
        status: 'degraded',
        summary: 'Conversation cache reported an integrity alert.',
        remediation: 'CACHE_DEGRADED',
      },
    ],
  }

  it('parses a contract v1 payload', () => {
    const report = parseServerDiagnosticsReport(valid)
    expect(report).not.toBeNull()
    expect(report!.contractVersion).toBe(SERVER_DIAGNOSTICS_CONTRACT_VERSION)
    expect(report!.overall).toBe('degraded')
    expect(report!.checks).toHaveLength(2)
    expect(report!.checks[1].remediation).toBe('CACHE_DEGRADED')
  })

  it('rejects missing checks', () => {
    expect(parseServerDiagnosticsReport({ contractVersion: 1, generatedAt: 'x', overall: 'ok' })).toBeNull()
  })

  it('skips malformed check entries', () => {
    const report = parseServerDiagnosticsReport({
      ...valid,
      checks: [valid.checks[0], { id: 'bad' }, valid.checks[1]],
    })
    expect(report!.checks.map((c) => c.id)).toEqual(['streamer', 'cache'])
  })
})

describe('serverDiagnostics helpers', () => {
  const report = parseServerDiagnosticsReport({
    contractVersion: 1,
    generatedAt: '2026-07-24T12:00:00.000Z',
    overall: 'failed',
    checks: [
      {
        id: 'pty',
        status: 'failed',
        summary: 'node-pty failed to load',
        remediation: 'PTY_UNAVAILABLE',
      },
    ],
  })!

  it('flags unsupported contract versions', () => {
    expect(isSupportedDiagnosticsContract(report)).toBe(true)
    expect(isSupportedDiagnosticsContract({ ...report, contractVersion: 2 })).toBe(false)
  })

  it('needsRemediation ignores NONE', () => {
    expect(needsRemediation('NONE')).toBe(false)
    expect(needsRemediation('PTY_UNAVAILABLE')).toBe(true)
  })

  it('formats a sanitized plain-text report', () => {
    const text = serverDiagnosticsToText('Studio Mac', report)
    expect(text).toContain('Studio Mac')
    expect(text).toContain('PTY_UNAVAILABLE')
    expect(text).toContain('[failed] pty')
    expect(text).not.toMatch(/api[_-]?key/i)
  })
})
