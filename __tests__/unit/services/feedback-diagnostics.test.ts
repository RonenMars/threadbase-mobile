import { buildFeedbackDiagnostics, diagnosticsToRows } from '@/services/feedback-diagnostics'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'

describe('buildFeedbackDiagnostics', () => {
  beforeEach(() => {
    useSettingsStore.setState({ crashReportingEnabled: false })
    useServersStore.setState({ servers: {}, activeServerIds: [] })
  })

  it('returns only allowlisted safe fields', () => {
    const d = buildFeedbackDiagnostics()
    expect(d.appVersion).toBe('1.0.0')
    expect(['ios', 'android', 'web']).toContain(d.platform)
    expect(['hermes', 'jsc']).toContain(d.jsEngine)
    expect(['local', 'remote', 'unknown']).toContain(d.connectionMode)
    expect(typeof d.serverCount).toBe('number')
    expect(typeof d.crashReportingEnabled).toBe('boolean')
    // No url/name/host/id fields leak into the shape
    const keys = Object.keys(d)
    expect(keys.some((k) => /url|host|apikey|token|name|path|id$/i.test(k) && k !== 'easUpdateId')).toBe(false)
  })

  it('reflects the crash-reporting consent state', () => {
    useSettingsStore.setState({ crashReportingEnabled: true })
    expect(buildFeedbackDiagnostics().crashReportingEnabled).toBe(true)
  })

  it('reports server COUNT only, never server details', () => {
    useServersStore.setState({
      servers: {
        s1: { id: 's1', url: 'https://secret.tunnel.example.com', apiKey: 'tb_live_x', isConnected: true, serverInfo: null, connectionError: null },
      },
      activeServerIds: ['s1'],
    })
    const d = buildFeedbackDiagnostics()
    expect(d.serverCount).toBe(1)
    // The url/apiKey never appear anywhere in the diagnostics output
    const json = JSON.stringify(d)
    expect(json.includes('secret.tunnel.example.com')).toBe(false)
    expect(json.includes('tb_live_x')).toBe(false)
  })

  it('derives remote connection mode from an https server without leaking the url', () => {
    useServersStore.setState({
      servers: {
        s1: { id: 's1', url: 'https://prod.tunnel.example.com', apiKey: 'k', isConnected: true, serverInfo: null, connectionError: null },
      },
      activeServerIds: ['s1'],
    })
    const d = buildFeedbackDiagnostics()
    expect(d.connectionMode).toBe('remote')
    expect(JSON.stringify(d).includes('example.com')).toBe(false)
  })

  it('derives local for a LAN server', () => {
    useServersStore.setState({
      servers: {
        s1: { id: 's1', url: 'http://192.168.1.5:8766', apiKey: 'k', isConnected: true, serverInfo: null, connectionError: null },
      },
      activeServerIds: ['s1'],
    })
    expect(buildFeedbackDiagnostics().connectionMode).toBe('local')
  })
})

describe('diagnosticsToRows', () => {
  it('produces label/value rows for all required fields', () => {
    const rows = diagnosticsToRows(buildFeedbackDiagnostics())
    const keys = rows.map((r) => r.key)
    expect(keys).toContain('appVersion')
    expect(keys).toContain('platform')
    expect(keys).toContain('connectionMode')
    expect(keys).toContain('serverCount')
    expect(keys).toContain('crashReportingEnabled')
    rows.forEach((r) => expect(typeof r.value).toBe('string'))
  })
})
