import { create } from 'zustand'
// Static, not `import()`: Jest 29 (jest-expo / SDK 57) throws
// "A dynamic import callback was invoked without --experimental-vm-modules"
// on native import(), so the load path was untestable regardless of mocks.
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from '@/services/secure-store'
import type { CacheAlert, ServerConfig, ServerInfo } from '@/types/api'
import { serverIdFromUrl } from '@/types/api'
import { authedFetch } from '@/services/authed-fetch'
import type { DeviceCapability } from '@/types/devices'
import { pickNextServerColor } from '@/components/sessions/shared/serverPalette'
import { recordDiagnosticEvent } from '@/services/diagnostic-events'
import { clearDeviceStaticKey } from '@/services/e2ee/pair-handshake'

const ASYNC_KEY_SERVERS = 'threadbase_servers'

// Legacy single-server keys (used for migration)
const LEGACY_SECURE_KEY = 'threadbase_api_key'
const LEGACY_ASYNC_KEY = 'threadbase_server_url'

function secureKeyForServer(serverId: string): string {
  return `threadbase_api_key_${serverId}`
}

function secureKeyForDeviceToken(serverId: string): string {
  return `threadbase_device_token_${serverId}`
}

/**
 * Extra facts a pair exchange produces, beyond the url/key/label a manual add
 * supplies. Named `…DeviceMeta` until `publicUrl` joined it, which is about the
 * server rather than the device.
 */
export interface AddServerMeta {
  deviceId?: string
  deviceToken?: string
  capabilities?: DeviceCapability[]
  /** What the server advertises as its public address. Recorded, never applied — see ServerConfig. */
  publicUrl?: string
  /** The server identity key the pairing handshake authenticated. Absent on a plaintext pairing. */
  serverPublicKey?: string
  /** Set only by a pairing that completed a Noise handshake; never cleared here. */
  requireEncryption?: boolean
}

/** Minimal shape persisted to AsyncStorage (no secrets). */
interface PersistedServer {
  id: string
  url: string
  label?: string
  connectionError?: string
  color?: string
  symbol?: string
  deviceId?: string
  deviceCapabilities?: DeviceCapability[]
  publicUrl?: string
  serverPublicKey?: string
  requireEncryption?: boolean
}

interface ServersStore {
  servers: Record<string, ServerConfig>
  /** Ordered list of server IDs the user has added. */
  activeServerIds: string[]
  /** Ordered subset of servers visible in sessions/history. */
  displayedServerIds: string[]
  isLoading: boolean
  /** Per-server scan progress received from `scan_progress` WS events. */
  scanProgress: Record<string, { scanned: number; total: number }>
  /** True once the user has added at least one server (ever). Used to distinguish first launch from "removed all servers". */
  hasEverHadServer: boolean
  /** Per-server pending cache-integrity alert, or null if none. */
  cacheAlert: Record<string, CacheAlert | null>

  addServer: (
    url: string,
    apiKey: string,
    label?: string,
    device?: AddServerMeta,
  ) => Promise<string | { error: 'duplicate' }>
  removeServer: (serverId: string) => Promise<void>
  setDisplayedServerIds: (ids: string[]) => void
  updateServerLabel: (serverId: string, label: string) => void
  setRequireEncryption: (serverId: string, requireEncryption: boolean) => void
  setConnected: (serverId: string, connected: boolean, info?: ServerInfo) => void
  setScanProgress: (serverId: string, scanned: number, total: number) => void
  setCacheAlert: (serverId: string, alert: CacheAlert | null) => void
  clearCacheAlert: (serverId: string, fingerprint: string) => void
  refreshServerInfo: (serverId: string) => Promise<void>
  editServer: (serverId: string, patch: { url: string; apiKey: string; label?: string }) => Promise<void | { error: 'duplicate' }>
  loadPersistedServers: () => Promise<void>
  getServer: (serverId: string) => ServerConfig | undefined
  reorderServers: (orderedIds: string[]) => void

  // Compat helpers used during migration from connection.ts consumers
  /** First server's URL, or fallback. */
  get serverUrl(): string
  /** First server's API key, or empty. */
  get apiKey(): string
}

async function persistServerList(
  servers: Record<string, ServerConfig>,
  order: string[],
  displayedServerIds: string[],
  hasEverHadServer: boolean,
) {
  const list: PersistedServer[] = order
    .filter((id) => Boolean(servers[id]))
    .map((id) => ({
      id: servers[id].id,
      url: servers[id].url,
      label: servers[id].label,
      connectionError: servers[id].connectionError ?? undefined,
      color: servers[id].color,
      symbol: servers[id].symbol,
      deviceId: servers[id].deviceId,
      deviceCapabilities: servers[id].deviceCapabilities,
      publicUrl: servers[id].publicUrl,
      serverPublicKey: servers[id].serverPublicKey,
      requireEncryption: servers[id].requireEncryption,
    }))
  const payload = {
    list,
    displayedServerIds: displayedServerIds.filter((id) => order.includes(id)),
    hasEverHadServer,
  }
  // SecureStore uses iOS Keychain, which survives app uninstalls
  await SecureStore.setItemAsync(ASYNC_KEY_SERVERS, JSON.stringify(payload))
}

function defaultDisplayedServerIds(order: string[]): string[] {
  if (order.length === 0) return []
  return [order[order.length - 1]]
}

function toValidUniqueIds(ids: string[], activeServerIds: string[]): string[] {
  return Array.from(new Set(ids)).filter((id) => activeServerIds.includes(id))
}

export const useServersStore = create<ServersStore>((set, get) => ({
  servers: {},
  activeServerIds: [],
  displayedServerIds: [],
  isLoading: true,
  scanProgress: {},
  hasEverHadServer: false,
  cacheAlert: {},

  get serverUrl() {
    const { servers, activeServerIds } = get()
    const first = activeServerIds[0]
    return first ? servers[first]?.url ?? 'http://localhost:7070' : 'http://localhost:7070'
  },

  get apiKey() {
    const { servers, activeServerIds } = get()
    const first = activeServerIds[0]
    return first ? servers[first]?.apiKey ?? '' : ''
  },

  getServer: (serverId: string) => get().servers[serverId],

  addServer: async (
    url: string,
    apiKey: string,
    label?: string,
    device?: AddServerMeta,
  ): Promise<string | { error: 'duplicate' }> => {
    const normalised = url.replace(/\/+$/, '')

    // Duplicate check: same normalised URL AND same API key
    const { servers, activeServerIds } = get()
    for (const id of activeServerIds) {
      const s = servers[id]
      if (s && s.url === normalised && s.apiKey === apiKey) {
        return { error: 'duplicate' }
      }
    }

    const id = serverIdFromUrl(normalised)
    await SecureStore.setItemAsync(secureKeyForServer(id), apiKey)
    if (device?.deviceToken) {
      await SecureStore.setItemAsync(secureKeyForDeviceToken(id), device.deviceToken)
    }

    const usedColors = activeServerIds.map((sid) => servers[sid]?.color)
    const color = pickNextServerColor(usedColors)

    const config: ServerConfig = {
      id,
      url: normalised,
      apiKey,
      label,
      isConnected: false,
      serverInfo: null,
      connectionError: null,
      color,
      deviceId: device?.deviceId,
      deviceToken: device?.deviceToken,
      deviceCapabilities: device?.capabilities,
      publicUrl: device?.publicUrl,
      serverPublicKey: device?.serverPublicKey,
    }

    set((state) => {
      const servers = { ...state.servers, [id]: config }
      const activeServerIds = state.activeServerIds.includes(id)
        ? state.activeServerIds
        : [...state.activeServerIds, id]
      const displayedServerIds = state.displayedServerIds.includes(id)
        ? state.displayedServerIds
        : [...state.displayedServerIds, id]
      persistServerList(servers, activeServerIds, displayedServerIds, true)
      return { servers, activeServerIds, displayedServerIds, hasEverHadServer: true }
    })

    // Through the one writer, never as a second one — and only ever to set it.
    // A pairing that did not encrypt says nothing about whether this device
    // should demand encryption, so it must not answer the question with `false`.
    if (device?.requireEncryption) get().setRequireEncryption(id, true)

    recordDiagnosticEvent('server_added')
    return id
  },

  removeServer: async (serverId: string) => {
    await SecureStore.deleteItemAsync(secureKeyForServer(serverId))
    await SecureStore.deleteItemAsync(secureKeyForDeviceToken(serverId))
    await clearDeviceStaticKey(serverId)
    recordDiagnosticEvent('server_removed')

    set((state) => {
      const { [serverId]: _removed, ...servers } = state.servers
      const activeServerIds = state.activeServerIds.filter((id) => id !== serverId)
      const prunedDisplayed = state.displayedServerIds.filter((id) => activeServerIds.includes(id))
      const displayedServerIds = prunedDisplayed.length > 0
        ? prunedDisplayed
        : defaultDisplayedServerIds(activeServerIds)
      persistServerList(servers, activeServerIds, displayedServerIds, state.hasEverHadServer)
      return { servers, activeServerIds, displayedServerIds }
    })
  },

  setDisplayedServerIds: (ids: string[]) => {
    set((state) => {
      const displayedServerIds = toValidUniqueIds(ids, state.activeServerIds)
      persistServerList(state.servers, state.activeServerIds, displayedServerIds, state.hasEverHadServer)
      return { displayedServerIds }
    })
  },

  reorderServers: (orderedIds: string[]) => {
    set((state) => {
      persistServerList(state.servers, orderedIds, state.displayedServerIds, state.hasEverHadServer)
      return { activeServerIds: orderedIds }
    })
  },

  updateServerLabel: (serverId: string, label: string) => {
    set((state) => {
      const server = state.servers[serverId]
      if (!server) return state
      const servers = { ...state.servers, [serverId]: { ...server, label } }
      persistServerList(servers, state.activeServerIds, state.displayedServerIds, state.hasEverHadServer)
      return { servers }
    })
  },

  // The one writer of the pin. The design has it auto-set on the first
  // successful encrypted connection too; that caller lands with the connection
  // wiring, and writes the same bit through here.
  setRequireEncryption: (serverId: string, requireEncryption: boolean) => {
    set((state) => {
      const server = state.servers[serverId]
      if (!server) return state
      const servers = { ...state.servers, [serverId]: { ...server, requireEncryption } }
      persistServerList(servers, state.activeServerIds, state.displayedServerIds, state.hasEverHadServer)
      return { servers }
    })
  },

  setConnected: (serverId: string, connected: boolean, info?: ServerInfo) => {
    set((state) => {
      const server = state.servers[serverId]
      if (!server) return state
      // Reset scan progress when disconnected so stale progress is not reused.
      const scanProgress = connected
        ? state.scanProgress
        : { ...state.scanProgress, [serverId]: { scanned: 0, total: 0 } }
      // Stale alert state from a disconnected server shouldn't linger in the UI.
      const cacheAlert = connected
        ? state.cacheAlert
        : { ...state.cacheAlert, [serverId]: null }

      return {
        servers: {
          ...state.servers,
          [serverId]: { ...server, isConnected: connected, serverInfo: info ?? server.serverInfo },
        },
        scanProgress,
        cacheAlert,
      }
    })
  },

  setScanProgress: (serverId: string, scanned: number, total: number) =>
    set((state) => ({
      scanProgress: { ...state.scanProgress, [serverId]: { scanned, total } },
    })),

  setCacheAlert: (serverId: string, alert: CacheAlert | null) =>
    set((state) => ({ cacheAlert: { ...state.cacheAlert, [serverId]: alert } })),

  clearCacheAlert: (serverId: string, fingerprint: string) =>
    set((state) => {
      const current = state.cacheAlert[serverId]
      if (!current || current.fingerprint !== fingerprint) return state
      return { cacheAlert: { ...state.cacheAlert, [serverId]: null } }
    }),

  refreshServerInfo: async (serverId: string): Promise<void> => {
    const server = get().servers[serverId]
    if (!server) return

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)

    try {
      // authedFetch falls back to the shared key until serverInfo has told us
      // this server keeps its device registry durably — which is exactly the
      // response this request fetches, so the first probe after pairing uses
      // the shared key and every one after it uses the scoped token.
      const response = await authedFetch(server, '/api/info', { signal: controller.signal })
      clearTimeout(timeout)
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`)
      }
      const info = await response.json() as ServerInfo
      set((state) => {
        const s = state.servers[serverId]
        if (!s) return state
        const updated = { ...s, serverInfo: info, connectionError: null }
        const servers = { ...state.servers, [serverId]: updated }
        persistServerList(servers, state.activeServerIds, state.displayedServerIds, state.hasEverHadServer)
        return { servers }
      })
    } catch (err) {
      clearTimeout(timeout)
      const isTimeout = err instanceof Error && err.name === 'AbortError'
      const message = isTimeout ? 'Request timed out after 12s' : (err instanceof Error ? err.message : String(err))
      set((state) => {
        const s = state.servers[serverId]
        if (!s) return state
        const updated = { ...s, serverInfo: null, connectionError: message }
        const servers = { ...state.servers, [serverId]: updated }
        persistServerList(servers, state.activeServerIds, state.displayedServerIds, state.hasEverHadServer)
        return { servers }
      })
    }
  },

  editServer: async (
    serverId: string,
    patch: { url: string; apiKey: string; label?: string },
  ): Promise<void | { error: 'duplicate' }> => {
    const normalised = patch.url.replace(/\/+$/, '')
    const { servers, activeServerIds } = get()

    // Duplicate check: same URL+key as any OTHER server
    for (const id of activeServerIds) {
      if (id === serverId) continue
      const s = servers[id]
      if (s && s.url === normalised && s.apiKey === patch.apiKey) {
        return { error: 'duplicate' }
      }
    }

    const existingServer = servers[serverId]
    if (!existingServer) return

    const urlChanged = normalised !== existingServer.url
    const newId = urlChanged ? serverIdFromUrl(normalised) : serverId

    // Update SecureStore key if ID changed
    if (urlChanged && newId !== serverId) {
      await SecureStore.deleteItemAsync(secureKeyForServer(serverId))
    }
    await SecureStore.setItemAsync(secureKeyForServer(newId), patch.apiKey)
    // A hand-edited URL or key is a different pairing, so the device identity
    // minted by the old exchange no longer applies. Dropping it matters now
    // that the token is actually presented as a credential: `...old` below
    // would otherwise carry it forward and we would authenticate as a device
    // the freshly-entered key may know nothing about.
    await SecureStore.deleteItemAsync(secureKeyForDeviceToken(serverId))
    if (newId !== serverId) await SecureStore.deleteItemAsync(secureKeyForDeviceToken(newId))
    // Same terms, same reason: this device's static key was registered by the
    // old exchange and the pinned server identity was proved by it. Neither
    // survives a hand-edited URL or key.
    await clearDeviceStaticKey(serverId)
    if (newId !== serverId) await clearDeviceStaticKey(newId)

    set((state) => {
      const { [serverId]: old, ...rest } = state.servers
      const updated: ServerConfig = {
        ...old,
        id: newId,
        url: normalised,
        apiKey: patch.apiKey,
        label: patch.label,
        isConnected: false,
        serverInfo: null,
        connectionError: null,
        deviceId: undefined,
        deviceToken: undefined,
        deviceCapabilities: undefined,
        // `requireEncryption` is deliberately NOT cleared alongside it. The
        // pinned key says "this is that machine" and stops applying; the pin
        // says "this device refuses plaintext" and is the user's demand, not
        // the pairing's. Clearing it here would make editing a URL a silent
        // downgrade — §6.1 requires a deliberate act with a confirmation.
        serverPublicKey: undefined,
      }
      const newServers = { ...rest, [newId]: updated }

      const replaceId = (id: string) => (id === serverId ? newId : id)
      const newActiveIds = state.activeServerIds.map(replaceId)
      const newDisplayedIds = state.displayedServerIds.map(replaceId)

      persistServerList(newServers, newActiveIds, newDisplayedIds, state.hasEverHadServer)
      return { servers: newServers, activeServerIds: newActiveIds, displayedServerIds: newDisplayedIds }
    })
  },

  loadPersistedServers: async () => {
    set({ isLoading: true })
    try {
      // ── Try SecureStore first (survives uninstall on iOS), then migrate from AsyncStorage ──
      const secureRaw = await SecureStore.getItemAsync(ASYNC_KEY_SERVERS)
      const asyncRaw = secureRaw ? null : await AsyncStorage.getItem(ASYNC_KEY_SERVERS)
      if (asyncRaw) {
        // Migrate existing AsyncStorage data to SecureStore
        await SecureStore.setItemAsync(ASYNC_KEY_SERVERS, asyncRaw)
        await AsyncStorage.removeItem(ASYNC_KEY_SERVERS)
      }
      const raw = secureRaw ?? asyncRaw
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        const legacyList = Array.isArray(parsed) ? (parsed as PersistedServer[]) : null
        const list = legacyList ?? (parsed as { list?: PersistedServer[] }).list ?? []
        const persistedDisplayed = legacyList
          ? undefined
          : (parsed as { displayedServerIds?: string[] }).displayedServerIds
        const servers: Record<string, ServerConfig> = {}
        const activeServerIds: string[] = []

        for (const entry of list) {
          const apiKey = (await SecureStore.getItemAsync(secureKeyForServer(entry.id))) ?? ''
          // The scoped device credential. It has been WRITTEN at pairing since
          // C5 and never read back, which is why every request went out with
          // the shared admin key instead. Undefined rather than '' so
          // `authToken` falls through cleanly for servers paired before C5.
          const deviceToken =
            (await SecureStore.getItemAsync(secureKeyForDeviceToken(entry.id))) ?? undefined
          // Auto-assign a color for legacy entries that predate the field.
          const color = entry.color ?? pickNextServerColor(
            activeServerIds.map((sid) => servers[sid]?.color),
          )
          servers[entry.id] = {
            id: entry.id,
            url: entry.url,
            apiKey,
            label: entry.label,
            isConnected: false,
            serverInfo: null,
            connectionError: entry.connectionError ?? null,
            color,
            symbol: entry.symbol,
            deviceId: entry.deviceId,
            deviceToken,
            deviceCapabilities: entry.deviceCapabilities,
            publicUrl: entry.publicUrl,
            serverPublicKey: entry.serverPublicKey,
            requireEncryption: entry.requireEncryption,
          }
          activeServerIds.push(entry.id)
        }

        const validDisplayed = (persistedDisplayed ?? []).filter((id) => activeServerIds.includes(id))
        const displayedServerIds = validDisplayed.length > 0
          ? validDisplayed
          : defaultDisplayedServerIds(activeServerIds)
        const hasEverHadServer = (parsed as { hasEverHadServer?: boolean }).hasEverHadServer
          ?? activeServerIds.length > 0
        set({ servers, activeServerIds, displayedServerIds, hasEverHadServer })
        return
      }

      // ── Migrate from legacy single-server keys ──
      const [legacyUrl, legacyKey] = await Promise.all([
        AsyncStorage.getItem(LEGACY_ASYNC_KEY),
        SecureStore.getItemAsync(LEGACY_SECURE_KEY),
      ])

      if (legacyUrl && legacyKey) {
        const normalised = legacyUrl.replace(/\/+$/, '')
        const id = serverIdFromUrl(normalised)

        // Persist in new format
        await SecureStore.setItemAsync(secureKeyForServer(id), legacyKey)

        const config: ServerConfig = {
          id,
          url: normalised,
          apiKey: legacyKey,
          isConnected: false,
          serverInfo: null,
          connectionError: null,
          color: pickNextServerColor([]),
        }

        const servers = { [id]: config }
        const activeServerIds = [id]
        const displayedServerIds = defaultDisplayedServerIds(activeServerIds)
        await persistServerList(servers, activeServerIds, displayedServerIds, true)

        // Clean up legacy keys
        await SecureStore.deleteItemAsync(LEGACY_SECURE_KEY)
        await AsyncStorage.removeItem(LEGACY_ASYNC_KEY)

        set({ servers, activeServerIds, displayedServerIds, hasEverHadServer: true })
      }
    } finally {
      set({ isLoading: false })
    }
  },
}))
