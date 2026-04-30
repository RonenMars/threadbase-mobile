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
