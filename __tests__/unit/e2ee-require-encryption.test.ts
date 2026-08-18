// The `requireEncryption` pin (#698): the device-side bit that decides whether
// falling back to plaintext is acceptable for a given server.
//
// It is separate from `serverSpeaksE2ee` on purpose. `GET /api/info` crosses
// the network unauthenticated, so an intermediary can strip `e2ee` from it; the
// pin is the half of the decision that lives on this device and cannot be
// deleted in flight. It therefore has to survive a restart, which is what the
// persistence round trip below is for.

import { E2EE_CLIENT_VERSION, encryptionPinRefuses } from '@/types/api'
import type { E2eeCapability, ServerConfig, ServerInfo } from '@/types/api'
import { useServersStore } from '@/stores/servers'

const mockSecureStore = new Map<string, string>()
jest.mock('@/services/secure-store', () => ({
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStore.set(key, value)
  }),
  getItemAsync: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStore.delete(key)
  }),
}))

const info = (e2ee?: Partial<E2eeCapability>): ServerInfo => ({
  version: '1.55.3',
  machineName: 'box',
  platform: 'darwin',
  activeSessions: 0,
  ...(e2ee
    ? { e2ee: { supported: true, enabled: true, version: E2EE_CLIENT_VERSION, required: false, ...e2ee } }
    : {}),
})

const SERVER_ID = 'srv_test1'

function seedServer(overrides: Partial<ServerConfig> = {}) {
  const server: ServerConfig = {
    id: SERVER_ID,
    url: 'http://192.168.1.10:7070',
    label: 'My Server',
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
    hasEverHadServer: true,
  })
  return server
}

beforeEach(() => {
  mockSecureStore.clear()
  useServersStore.setState({
    servers: {},
    activeServerIds: [],
    displayedServerIds: [],
    isLoading: false,
    hasEverHadServer: false,
    cacheAlert: {},
  })
})

describe('encryptionPinRefuses', () => {
  it('refuses a pinned server that reports encryption switched off', () => {
    // The positive control. Without it every assertion below would pass on a
    // predicate that returns false unconditionally — which is exactly the
    // failure mode that makes the pin decorative.
    expect(
      encryptionPinRefuses({ requireEncryption: true, serverInfo: info({ enabled: false }) }),
    ).toBe(true)
  })

  it('refuses a pinned server whose /api/info mentions no encryption at all', () => {
    // The shape an intermediary that strips the field produces, and the shape
    // every streamer in the field today produces. Indistinguishable, and both
    // are refused, which is the point.
    expect(encryptionPinRefuses({ requireEncryption: true, serverInfo: info() })).toBe(true)
  })

  it('refuses a pinned server speaking an envelope version this build cannot', () => {
    expect(
      encryptionPinRefuses({
        requireEncryption: true,
        serverInfo: info({ version: E2EE_CLIENT_VERSION + 1 }),
      }),
    ).toBe(true)
  })

  it('allows a pinned server that is actually offering encryption', () => {
    expect(encryptionPinRefuses({ requireEncryption: true, serverInfo: info({}) })).toBe(false)
  })

  it('says nothing about a pinned server that has not answered yet', () => {
    // Unreachable is a different problem with a different message. Calling it a
    // downgrade would name the wrong cause on every flaky network.
    expect(encryptionPinRefuses({ requireEncryption: true, serverInfo: null })).toBe(false)
  })

  it('allows an unpinned server regardless of what it reports', () => {
    expect(encryptionPinRefuses({ requireEncryption: undefined, serverInfo: info() })).toBe(false)
    expect(
      encryptionPinRefuses({ requireEncryption: false, serverInfo: info({ enabled: false }) }),
    ).toBe(false)
  })
})

/**
 * Reads back what `persistServerList` wrote to SecureStore.
 *
 * The matching read is `loadPersistedServers` below. An in-memory round trip
 * through the store's own state is not that test: it passes whenever the write
 * and read copies have not yet diverged, which is the failure being guarded
 * against. The load case wipes the in-memory map first and then exercises the
 * real load path.
 */
function persistedPin(): boolean | undefined {
  const raw = mockSecureStore.get('threadbase_servers')
  if (!raw) return undefined
  const payload = JSON.parse(raw) as { list: { id: string; requireEncryption?: boolean }[] }
  return payload.list.find((entry) => entry.id === SERVER_ID)?.requireEncryption
}

function forgetInMemoryServers() {
  useServersStore.setState({
    servers: {},
    activeServerIds: [],
    displayedServerIds: [],
    isLoading: false,
    hasEverHadServer: false,
    cacheAlert: {},
  })
}

describe('setRequireEncryption', () => {
  it('writes the pin into the persisted server record', async () => {
    // A pin that evaporates on relaunch is worse than no pin: the user believes
    // they answered the question once.
    seedServer()
    useServersStore.getState().setRequireEncryption(SERVER_ID, true)
    expect(useServersStore.getState().servers[SERVER_ID].requireEncryption).toBe(true)

    await Promise.resolve()
    expect(persistedPin()).toBe(true)
  })

  it('writes the cleared pin too, rather than dropping the field', async () => {
    // The positive control: this would also pass if `persistServerList` had
    // hardcoded `requireEncryption: true`.
    seedServer({ requireEncryption: true })
    useServersStore.getState().setRequireEncryption(SERVER_ID, false)

    await Promise.resolve()
    expect(persistedPin()).toBe(false)
  })

  it('leaves the pin alone when the server id is unknown', () => {
    seedServer()
    useServersStore.getState().setRequireEncryption('srv_nonexistent', true)
    expect(useServersStore.getState().servers[SERVER_ID].requireEncryption).toBeUndefined()
  })
})

describe('loadPersistedServers – encryption fields', () => {
  it('restores the require-encryption pin from the persisted store after memory is wiped', async () => {
    // A reader that dropped the field on load would look identical to an
    // unpinned server: the next connection goes out in plaintext, with nothing
    // pointing back here. Wiping in-memory state first is the point — a pass
    // that still had the write copy in the zustand map would not catch that.
    seedServer()
    useServersStore.getState().setRequireEncryption(SERVER_ID, true)
    await Promise.resolve()
    expect(persistedPin()).toBe(true)

    forgetInMemoryServers()
    expect(useServersStore.getState().servers[SERVER_ID]).toBeUndefined()

    await useServersStore.getState().loadPersistedServers()

    expect(useServersStore.getState().servers[SERVER_ID].requireEncryption).toBe(true)
  })
})
