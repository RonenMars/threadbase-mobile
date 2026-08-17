import {
  parsePersistedServers,
  serverConfigFromPersisted,
  useServersStore,
} from '@/stores/servers'
// Read through the app's own module, never `expo-secure-store` directly: Metro
// swaps this one for a localStorage shim on web, so it is the boundary the app
// actually uses. The mock below stands in for whatever it re-exports.
import * as SecureStore from '@/services/secure-store'

// Mock SecureStore so tests don't hit the keychain
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))

const setItemAsync = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>
const deleteItemAsync = SecureStore.deleteItemAsync as jest.MockedFunction<
  typeof SecureStore.deleteItemAsync
>

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

// ── The pairing handshake's half of the server record (#698) ────────────────
//
// `loadPersistedServers` still cannot be executed by a test: its first statement
// awaits a dynamic `import()` of AsyncStorage, and jest runs without
// `--experimental-vm-modules`, so that throws — `TypeError: A dynamic import
// callback was invoked without --experimental-vm-modules` — regardless of
// `moduleNameMapper`. Verified with a bare
// `await import('@react-native-async-storage/async-storage')` in a throwaway
// test rather than assumed.
//
// Its *reader* is now reachable: `parsePersistedServers` and
// `serverConfigFromPersisted` are the two halves that dropping a field would
// break, and the round trip below drives them with the exact string
// `persistServerList` wrote. That is deliberately not a round trip through the
// store's in-memory state, which passes whenever the write and read copies have
// not yet diverged — precisely the failure being guarded against.

describe('addServer – e2ee material', () => {
  const SPK = 'A'.repeat(43)
  const URL = 'http://192.168.68.125:8766'

  /** The exact string `persistServerList` handed to SecureStore, latest first. */
  function persistedPayload(): string {
    const call = setItemAsync.mock.calls.filter(([key]) => key === 'threadbase_servers').pop()
    if (!call) throw new Error('the server list was never persisted')
    return String(call[1])
  }

  function persistedList(): Record<string, unknown>[] {
    return (JSON.parse(persistedPayload()) as { list: Record<string, unknown>[] }).list
  }

  it('records the pinned server key and the pin, in memory and on disk', async () => {
    // On disk matters on its own: `persistServerList` builds its own object
    // literal, so a field added to ServerConfig alone survives until the next
    // launch and then only a re-pair recovers it.
    const id = await useServersStore.getState().addServer(URL, 'key-abc', undefined, {
      serverPublicKey: SPK,
      requireEncryption: true,
    })

    const server = useServersStore.getState().getServer(String(id))
    expect(server?.serverPublicKey).toBe(SPK)
    expect(server?.requireEncryption).toBe(true)

    const entry = persistedList().find((s) => s.url === URL)
    expect(entry?.serverPublicKey).toBe(SPK)
    expect(entry?.requireEncryption).toBe(true)
  })

  it('leaves the pin unanswered for a pairing that did not encrypt', async () => {
    // The positive control's sibling: `requireEncryption` must stay absent
    // rather than becoming `false`, because "we did not encrypt this time" is
    // not an answer to "does this device demand encryption".
    const id = await useServersStore.getState().addServer(URL, 'key-abc', undefined, {
      requireEncryption: false,
    })

    const server = useServersStore.getState().getServer(String(id))
    expect(server?.requireEncryption).toBeUndefined()
    expect(server?.serverPublicKey).toBeUndefined()
  })

  it('forgets this device static key when the server is removed', async () => {
    const id = String(await useServersStore.getState().addServer(URL, 'key-abc'))
    deleteItemAsync.mockClear()

    await useServersStore.getState().removeServer(id)

    expect(deleteItemAsync).toHaveBeenCalledWith(`threadbase_e2ee_device_key_${id}`)
  })

  async function addPinnedServer(): Promise<string> {
    return String(
      await useServersStore.getState().addServer(URL, 'key-abc', 'Old name', {
        deviceId: 'device-1',
        deviceToken: 'dt_1',
        serverPublicKey: SPK,
        requireEncryption: true,
      }),
    )
  }

  it('preserves the device key, server key and pin on a label-only edit', async () => {
    // The edit UI always submits url, key and label together, so a rename
    // arrives looking exactly like a re-pointing. Treating it as one deleted
    // D_priv and the pinned key while keeping `requireEncryption`, which left
    // the pin demanding encryption of a server it could no longer recognise.
    const id = await addPinnedServer()
    deleteItemAsync.mockClear()

    await useServersStore.getState().editServer(id, {
      url: URL,
      apiKey: 'key-abc',
      label: 'New name',
    })

    const server = useServersStore.getState().getServer(id)
    expect(server?.label).toBe('New name')
    expect(server?.serverPublicKey).toBe(SPK)
    expect(server?.requireEncryption).toBe(true)
    expect(server?.deviceToken).toBe('dt_1')
    expect(deleteItemAsync).not.toHaveBeenCalledWith(`threadbase_e2ee_device_key_${id}`)
    expect(deleteItemAsync).not.toHaveBeenCalledWith(`threadbase_device_token_${id}`)
  })

  it.each([
    ['a new api key', { url: URL, apiKey: 'key-different' }],
    ['a new url', { url: 'http://192.168.68.126:8766', apiKey: 'key-abc' }],
  ])('clears device key, server key and pin together on %s', async (_label, patch) => {
    // The three describe one pairing, so they move as one. A pin left behind
    // after the identity it was proved against is gone points at nothing, and a
    // pinned key left behind after the URL moved claims a machine never reached.
    // Replacing the identity by hand is itself the deliberate act §6.1 requires.
    const id = await addPinnedServer()
    deleteItemAsync.mockClear()

    await useServersStore.getState().editServer(id, patch)

    const newId = useServersStore.getState().activeServerIds[0]
    const server = useServersStore.getState().getServer(newId)
    expect(server?.serverPublicKey).toBeUndefined()
    expect(server?.requireEncryption).toBeUndefined()
    expect(server?.deviceToken).toBeUndefined()
    expect(deleteItemAsync).toHaveBeenCalledWith(`threadbase_e2ee_device_key_${id}`)
  })
})

// ── The read half, driven by the exact bytes the write half produced ─────────

describe('reading a persisted server back', () => {
  const SPK = 'B'.repeat(43)
  const URL = 'http://192.168.68.130:8766'

  it('restores every field the persisted entry carried', async () => {
    // Not a round trip through `useServersStore`'s in-memory state: that passes
    // whenever the write and read copies have not yet diverged, which is exactly
    // the divergence this is here to catch. The input is the string
    // `persistServerList` actually wrote.
    await useServersStore.getState().addServer(URL, 'key-abc', 'Studio Mac', {
      deviceId: 'device-9',
      deviceToken: 'dt_9',
      capabilities: ['history:read'],
      publicUrl: 'https://tunnel.example.test',
      serverPublicKey: SPK,
      requireEncryption: true,
    })

    const written = setItemAsync.mock.calls
      .filter(([key]) => key === 'threadbase_servers')
      .pop()
    const parsed = parsePersistedServers(String(written?.[1]))
    const entry = parsed.list.find((s) => s.url === URL)
    expect(entry).toBeDefined()
    if (!entry) return

    const restored = serverConfigFromPersisted(
      entry,
      { apiKey: 'key-abc', deviceToken: 'dt_9' },
      '#123456',
    )

    expect(restored.serverPublicKey).toBe(SPK)
    expect(restored.requireEncryption).toBe(true)
    expect(restored.publicUrl).toBe('https://tunnel.example.test')
    expect(restored.deviceId).toBe('device-9')
    expect(restored.deviceToken).toBe('dt_9')
    expect(restored.deviceCapabilities).toEqual(['history:read'])
    expect(restored.label).toBe('Studio Mac')
    expect(restored.url).toBe(URL)
  })

  it('reads back the bare-array shape that predates the wrapper object', () => {
    const parsed = parsePersistedServers(
      JSON.stringify([{ id: 'srv_legacy', url: URL, serverPublicKey: SPK }]),
    )
    expect(parsed.list).toHaveLength(1)
    expect(parsed.list[0].serverPublicKey).toBe(SPK)
    expect(parsed.hasEverHadServer).toBeUndefined()
  })
})
