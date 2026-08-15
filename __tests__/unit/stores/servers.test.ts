import { useServersStore } from '@/stores/servers'

// Mock SecureStore so tests don't hit the keychain
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))

// Mock fetch for refreshServerInfo
const mockFetch = jest.fn()
global.fetch = mockFetch

function seedServer(overrides: Partial<import('@/types/api').ServerConfig> = {}) {
  const server = {
    id: 'srv_test1',
    url: 'http://192.168.1.10:7070',
    apiKey: 'key-abc',
    isConnected: false,
    serverInfo: null,
    connectionError: null,
    ...overrides,
  }
  useServersStore.setState({
    servers: { [server.id]: server },
    activeServerIds: [server.id],
    displayedServerIds: [server.id],
    isLoading: false,
  })
  return server
}

beforeEach(() => {
  useServersStore.setState({
    servers: {},
    activeServerIds: [],
    displayedServerIds: [],
    isLoading: false,
    cacheAlert: {},
  })
  jest.clearAllMocks()
})

// ── addServer duplicate detection ──────────────────────────────────────────

describe('addServer – duplicate detection', () => {
  it('returns duplicate error when URL and API key both match an existing server', async () => {
    seedServer()
    const result = await useServersStore.getState().addServer(
      'http://192.168.1.10:7070',
      'key-abc',
    )
    expect(result).toEqual({ error: 'duplicate' })
  })

  it('allows same URL with different API key', async () => {
    seedServer()
    const result = await useServersStore.getState().addServer(
      'http://192.168.1.10:7070',
      'key-different',
    )
    expect(result).not.toEqual({ error: 'duplicate' })
  })

  it('allows same API key with different URL', async () => {
    seedServer()
    const result = await useServersStore.getState().addServer(
      'http://192.168.1.99:7070',
      'key-abc',
    )
    expect(result).not.toEqual({ error: 'duplicate' })
  })

  it('returns server ID string on success', async () => {
    const result = await useServersStore.getState().addServer(
      'http://192.168.1.10:7070',
      'key-abc',
    )
    expect(typeof result).toBe('string')
    expect((result as string).startsWith('srv_')).toBe(true)
  })
})

// ── refreshServerInfo ──────────────────────────────────────────────────────

describe('refreshServerInfo', () => {
  it('updates serverInfo and clears connectionError on success', async () => {
    const server = seedServer({ connectionError: 'previous error' })
    const info = { version: '1.4.2', machineName: 'mac-pro', platform: 'macOS', activeSessions: 0 }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => info,
    })

    await useServersStore.getState().refreshServerInfo(server.id)

    const updated = useServersStore.getState().servers[server.id]
    expect(updated.serverInfo).toEqual(info)
    expect(updated.connectionError).toBeNull()
  })

  it('sets connectionError and clears serverInfo on fetch failure', async () => {
    const server = seedServer({ serverInfo: { version: '1.0', machineName: 'old', platform: 'macOS', activeSessions: 0 } })
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    await useServersStore.getState().refreshServerInfo(server.id)

    const updated = useServersStore.getState().servers[server.id]
    expect(updated.serverInfo).toBeNull()
    expect(updated.connectionError).toContain('ECONNREFUSED')
  })

  it('sets connectionError on non-ok HTTP response', async () => {
    const server = seedServer()
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })

    await useServersStore.getState().refreshServerInfo(server.id)

    const updated = useServersStore.getState().servers[server.id]
    expect(updated.connectionError).toBeTruthy()
  })

  it('does nothing if serverId does not exist', async () => {
    await expect(
      useServersStore.getState().refreshServerInfo('nonexistent')
    ).resolves.not.toThrow()
  })
})

// ── editServer ────────────────────────────────────────────────────────────

describe('editServer', () => {
  it('updates label without changing ID when URL is unchanged', async () => {
    const server = seedServer()
    await useServersStore.getState().editServer(server.id, {
      url: server.url,
      apiKey: server.apiKey,
      label: 'New Label',
    })
    const state = useServersStore.getState()
    expect(state.servers[server.id].label).toBe('New Label')
    expect(state.activeServerIds).toEqual([server.id])
  })

  it('replaces server entry at same position when URL changes', async () => {
    seedServer()
    // add a second server so we can verify position preservation
    useServersStore.setState((s) => {
      const second = { id: 'srv_second', url: 'http://other:7070', apiKey: 'k2', isConnected: false, serverInfo: null, connectionError: null }
      return {
        servers: { ...s.servers, srv_second: second },
        activeServerIds: [...s.activeServerIds, 'srv_second'],
        displayedServerIds: [...s.displayedServerIds, 'srv_second'],
      }
    })

    await useServersStore.getState().editServer('srv_test1', {
      url: 'http://192.168.1.99:7070',
      apiKey: 'key-abc',
      label: 'Renamed',
    })

    const state = useServersStore.getState()
    const newId = Object.keys(state.servers).find((id) => state.servers[id].url === 'http://192.168.1.99:7070')
    expect(newId).toBeTruthy()
    expect(state.activeServerIds[0]).toBe(newId) // same position (index 0)
    expect(state.activeServerIds).not.toContain('srv_test1')
  })

  it('returns duplicate error when new URL+key matches another server', async () => {
    seedServer()
    useServersStore.setState((s) => {
      const second = { id: 'srv_second', url: 'http://other:7070', apiKey: 'k2', isConnected: false, serverInfo: null, connectionError: null }
      return {
        servers: { ...s.servers, srv_second: second },
        activeServerIds: [...s.activeServerIds, 'srv_second'],
        displayedServerIds: [...s.displayedServerIds, 'srv_second'],
      }
    })

    const result = await useServersStore.getState().editServer('srv_test1', {
      url: 'http://other:7070',
      apiKey: 'k2',
      label: '',
    })
    expect(result).toEqual({ error: 'duplicate' })
  })
})

// ── reorderServers ─────────────────────────────────────────────────────────

describe('reorderServers', () => {
  function seedTwoServers() {
    const a = { id: 'srv_a', url: 'http://a.local:7070', apiKey: 'key-a', isConnected: false, serverInfo: null, connectionError: null }
    const b = { id: 'srv_b', url: 'http://b.local:7070', apiKey: 'key-b', isConnected: false, serverInfo: null, connectionError: null }
    useServersStore.setState({
      servers: { srv_a: a, srv_b: b },
      activeServerIds: ['srv_a', 'srv_b'],
      displayedServerIds: ['srv_a', 'srv_b'],
      isLoading: false,
    })
  }

  it('reorders activeServerIds to the provided order', () => {
    seedTwoServers()
    useServersStore.getState().reorderServers(['srv_b', 'srv_a'])
    expect(useServersStore.getState().activeServerIds).toEqual(['srv_b', 'srv_a'])
  })

  it('does not change displayedServerIds membership', () => {
    seedTwoServers()
    useServersStore.getState().reorderServers(['srv_b', 'srv_a'])
    const { displayedServerIds } = useServersStore.getState()
    expect(displayedServerIds).toEqual(['srv_a', 'srv_b'])
  })

  it('calls persistServerList (SecureStore.setItemAsync)', () => {
    const SecureStore = require('expo-secure-store')
    seedTwoServers()
    useServersStore.getState().reorderServers(['srv_b', 'srv_a'])
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'threadbase_servers',
      expect.stringContaining('"srv_b"'),
    )
  })
})

// ── cacheAlert ──────────────────────────────────────────────────────────────

describe('setCacheAlert / clearCacheAlert', () => {
  const alert = {
    fingerprint: 'fp1',
    severity: 'high' as const,
    detectedAt: '2026-07-18T00:00:00.000Z',
    missingCount: 3,
    totalRows: 10,
  }

  it('setCacheAlert stores the alert wholesale', () => {
    const server = seedServer()
    useServersStore.getState().setCacheAlert(server.id, alert)
    expect(useServersStore.getState().cacheAlert[server.id]).toEqual(alert)
  })

  it('setCacheAlert replaces a previous alert for the same server', () => {
    const server = seedServer()
    useServersStore.getState().setCacheAlert(server.id, alert)
    const updated = { ...alert, fingerprint: 'fp2', missingCount: 5 }
    useServersStore.getState().setCacheAlert(server.id, updated)
    expect(useServersStore.getState().cacheAlert[server.id]).toEqual(updated)
  })

  it('clearCacheAlert clears when the fingerprint matches', () => {
    const server = seedServer()
    useServersStore.getState().setCacheAlert(server.id, alert)
    useServersStore.getState().clearCacheAlert(server.id, 'fp1')
    expect(useServersStore.getState().cacheAlert[server.id]).toBeNull()
  })

  it('clearCacheAlert is a no-op when the fingerprint does not match (stale resolve racing a newer alert)', () => {
    const server = seedServer()
    const newerAlert = { ...alert, fingerprint: 'fp2' }
    useServersStore.getState().setCacheAlert(server.id, newerAlert)
    useServersStore.getState().clearCacheAlert(server.id, 'fp1')
    expect(useServersStore.getState().cacheAlert[server.id]).toEqual(newerAlert)
  })

  it('clearCacheAlert is a no-op when there is no pending alert', () => {
    const server = seedServer()
    expect(() => useServersStore.getState().clearCacheAlert(server.id, 'fp1')).not.toThrow()
    expect(useServersStore.getState().cacheAlert[server.id]).toBeUndefined()
  })

  it('setConnected(false) clears the alert for a disconnected server', () => {
    const server = seedServer({ isConnected: true })
    useServersStore.getState().setCacheAlert(server.id, alert)
    useServersStore.getState().setConnected(server.id, false)
    expect(useServersStore.getState().cacheAlert[server.id]).toBeNull()
  })

  it('setConnected(true) does not touch an existing alert', () => {
    const server = seedServer({ isConnected: false })
    useServersStore.getState().setCacheAlert(server.id, alert)
    useServersStore.getState().setConnected(server.id, true)
    expect(useServersStore.getState().cacheAlert[server.id]).toEqual(alert)
  })
})

// ── publicUrl is recorded, never substituted (TB-S-13) ─────────────────────

describe('addServer – publicUrl', () => {
  const SecureStore = jest.requireMock('expo-secure-store') as {
    setItemAsync: jest.Mock
  }

  /** The payload the store wrote under the server-list key, parsed. */
  function persistedList(): Array<Record<string, unknown>> {
    const call = SecureStore.setItemAsync.mock.calls
      .filter(([key]) => key === 'threadbase_servers')
      .pop()
    if (!call) throw new Error('the server list was never persisted')
    return (JSON.parse(String(call[1])) as { list: Array<Record<string, unknown>> }).list
  }

  it('keeps the typed url and records publicUrl beside it', async () => {
    const id = await useServersStore.getState().addServer(
      'http://192.168.68.125:8766',
      'key-abc',
      undefined,
      { publicUrl: 'https://tunnel.example.test' },
    )

    const server = useServersStore.getState().getServer(String(id))
    expect(server?.url).toBe('http://192.168.68.125:8766')
    expect(server?.publicUrl).toBe('https://tunnel.example.test')
  })

  // In memory is not enough: the field has to survive the write, or it is lost
  // on the next launch and only a re-pair recovers it. `persistServerList`
  // builds its own object literal, so a field added to ServerConfig alone is
  // silently dropped here — which is the shape of bug this asserts against.
  it('writes publicUrl into the persisted server list', async () => {
    await useServersStore.getState().addServer(
      'http://192.168.68.125:8766',
      'key-abc',
      undefined,
      { publicUrl: 'https://tunnel.example.test' },
    )

    const entry = persistedList().find((s) => s.url === 'http://192.168.68.125:8766')
    expect(entry).toBeDefined()
    expect(entry?.publicUrl).toBe('https://tunnel.example.test')
  })

  it('leaves publicUrl undefined for a manual add that has none', async () => {
    const id = await useServersStore.getState().addServer('http://10.0.0.5:8766', 'key-xyz')
    expect(useServersStore.getState().getServer(String(id))?.publicUrl).toBeUndefined()
  })
})
