import {
  generateDiagnostics,
  diagnosticsToText,
  diagnosticsToJson,
  diagnosticsToRows,
} from '@/services/diagnostics'
import { recordDiagnosticEvent, clearDiagnosticEvents } from '@/services/diagnostic-events'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'

// Sensitive values seeded into the stores that must NEVER appear in output.
const SENSITIVE = {
  url: 'https://secret-machine.tunnel.example.com:8443',
  wsKey: 'tb_live_9f8a7b6c5d4e3f2a1b0c',
  apiKey: 'tb_live_deadbeefcafe1234',
  machineName: 'ronens-macbook-pro',
  label: 'My Private Work Server',
  serverId: 'srv_secretfingerprint',
}

function seedStores() {
  useServersStore.setState({
    servers: {
      [SENSITIVE.serverId]: {
        id: SENSITIVE.serverId,
        url: SENSITIVE.url,
        apiKey: SENSITIVE.apiKey,
        label: SENSITIVE.label,
        isConnected: true,
        connectionError: null,
        serverInfo: {
          version: '2.3.1',
          machineName: SENSITIVE.machineName,
          platform: 'darwin',
          activeSessions: 4,
        },
      },
    },
    activeServerIds: [SENSITIVE.serverId],
    displayedServerIds: [SENSITIVE.serverId],
    hasEverHadServer: true,
  })
  useSettingsStore.setState({ crashReportingEnabled: true })
  useServerFetchStatusStore.setState({
    statuses: { [SENSITIVE.serverId]: { status: 'ok', lastCheckedAt: 1720000000000 } },
  })
}

beforeEach(() => {
  clearDiagnosticEvents()
  seedStores()
})

describe('generateDiagnostics — safe allowlist', () => {
  it('collects only safe fields', async () => {
    const d = await generateDiagnostics()
    expect(d.appVersion).toBe('1.0.0')
    expect(['ios', 'android', 'web']).toContain(d.platform)
    expect(['local', 'remote', 'unknown']).toContain(d.connectionMode)
    expect(['connected', 'connecting', 'disconnected', 'error', 'unknown']).toContain(d.connectionState)
    expect(d.serverCount).toBe(1)
    expect(d.displayedServerCount).toBe(1)
    expect(d.hasEverHadServer).toBe(true)
    expect(d.activeSessionCount).toBe(4)
    expect(d.streamerVersions).toEqual(['2.3.1'])
    expect(d.crashReportingEnabled).toBe(true)
    expect(['granted', 'denied', 'undetermined']).toContain(d.notificationPermission)
  })

  it('exposes streamer version (generic) but never machineName', async () => {
    const d = await generateDiagnostics()
    expect(d.streamerVersions).toContain('2.3.1')
    expect(JSON.stringify(d).includes(SENSITIVE.machineName)).toBe(false)
  })

  it('reports a coarse (minute-precision) last connection time', async () => {
    const d = await generateDiagnostics()
    expect(d.lastConnectionAt).toBeDefined()
    // minute precision: YYYY-MM-DDTHH:MMZ, no seconds
    expect(d.lastConnectionAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/)
  })

  it('derives remote connection mode from the https server without leaking the url', async () => {
    const d = await generateDiagnostics()
    expect(d.connectionMode).toBe('remote')
    expect(JSON.stringify(d).includes('tunnel.example.com')).toBe(false)
  })
})

describe('generateDiagnostics — PROVE sensitive values cannot appear', () => {
  it('the report object contains no server url/key/id/name/label', async () => {
    const json = JSON.stringify(await generateDiagnostics())
    for (const [name, value] of Object.entries(SENSITIVE)) {
      expect(json.includes(value)).toBe(false)
      if (json.includes(value)) throw new Error(`Leaked ${name}: ${value}`)
    }
  })

  it('the TEXT output contains no sensitive values', async () => {
    const text = diagnosticsToText(await generateDiagnostics())
    for (const value of Object.values(SENSITIVE)) {
      expect(text.includes(value)).toBe(false)
    }
    // and it still contains safe data
    expect(text.includes('appVersion')).toBe(true)
    expect(text.includes('2.3.1')).toBe(true)
  })

  it('the JSON output contains no sensitive values', async () => {
    const json = diagnosticsToJson(await generateDiagnostics())
    for (const value of Object.values(SENSITIVE)) {
      expect(json.includes(value)).toBe(false)
    }
  })

  it('recent events are enum tokens only — a smuggled value cannot enter', async () => {
    // recordDiagnosticEvent ignores non-enum input by construction.
    // @ts-expect-error intentional bad input
    recordDiagnosticEvent(SENSITIVE.url)
    recordDiagnosticEvent('app_started')
    const d = await generateDiagnostics()
    expect(d.recentEvents.map((e) => e.event)).toEqual(['app_started'])
    expect(JSON.stringify(d.recentEvents).includes('tunnel.example.com')).toBe(false)
  })

  it('caps text and JSON output sizes', async () => {
    const d = await generateDiagnostics()
    expect(diagnosticsToText(d).length).toBeLessThanOrEqual(8 * 1024)
    expect(diagnosticsToJson(d).length).toBeLessThanOrEqual(16 * 1024)
  })

  it('never embeds a whole serverInfo / server object (regression guard)', async () => {
    // The generator must pick scalar fields by name (version, activeSessions),
    // never spread a serverInfo/ServerConfig object — which would drag in
    // machineName, platform, url, apiKey, or label. Assert no such nested object.
    const d = await generateDiagnostics() as unknown as Record<string, unknown>
    for (const value of Object.values(d)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const keys = Object.keys(value as Record<string, unknown>)
        expect(keys).not.toContain('machineName')
        expect(keys).not.toContain('apiKey')
        expect(keys).not.toContain('serverInfo')
        expect(keys).not.toContain('url')
      }
    }
    // recentEvents entries are only {event, at}
    for (const e of d.recentEvents as { event: string; at: string }[]) {
      expect(Object.keys(e).sort()).toEqual(['at', 'event'])
    }
  })
})

describe('diagnosticsToRows', () => {
  it('produces string rows for the required safe fields', async () => {
    const rows = diagnosticsToRows(await generateDiagnostics())
    const keys = rows.map((r) => r.key)
    expect(keys).toContain('appVersion')
    expect(keys).toContain('connectionMode')
    expect(keys).toContain('connectionState')
    expect(keys).toContain('serverCount')
    expect(keys).toContain('notificationPermission')
    expect(keys).toContain('crashReportingEnabled')
    rows.forEach((r) => expect(typeof r.value).toBe('string'))
    // no row key or value is a sensitive value
    const flat = JSON.stringify(rows)
    for (const value of Object.values(SENSITIVE)) expect(flat.includes(value)).toBe(false)
  })
})
