import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import type { ServerConfig, ServerInfo } from '@/types/api'
import { serverIdFromUrl } from '@/types/api'

const ASYNC_KEY_SERVERS = 'threadbase_servers'

// Legacy single-server keys (used for migration)
const LEGACY_SECURE_KEY = 'threadbase_api_key'
const LEGACY_ASYNC_KEY = 'threadbase_server_url'

function secureKeyForServer(serverId: string): string {
  return `threadbase_api_key_${serverId}`
}

/** Minimal shape persisted to AsyncStorage (no secrets). */
interface PersistedServer {
  id: string
  url: string
  label?: string
}

interface ServersStore {
  servers: Record<string, ServerConfig>
  /** Ordered list of server IDs the user has added. */
  activeServerIds: string[]
  /** Ordered subset of servers visible in sessions/history. */
  displayedServerIds: string[]
  isLoading: boolean

  addServer: (url: string, apiKey: string, label?: string) => Promise<string>
  removeServer: (serverId: string) => Promise<void>
  setDisplayedServerIds: (ids: string[]) => void
  updateServerLabel: (serverId: string, label: string) => void
  setConnected: (serverId: string, connected: boolean, info?: ServerInfo) => void
  loadPersistedServers: () => Promise<void>
  getServer: (serverId: string) => ServerConfig | undefined

  // Compat helpers used during migration from connection.ts consumers
  /** First server's URL, or fallback. */
  get serverUrl(): string
  /** First server's API key, or empty. */
  get apiKey(): string
}

async function getAsyncStorage() {
  return (await import('@react-native-async-storage/async-storage')).default
}

async function persistServerList(
  servers: Record<string, ServerConfig>,
  order: string[],
  displayedServerIds: string[],
) {
  const list: PersistedServer[] = order
    .filter((id) => Boolean(servers[id]))
    .map((id) => ({
      id: servers[id].id,
      url: servers[id].url,
      label: servers[id].label,
    }))
  const payload = {
    list,
    displayedServerIds: displayedServerIds.filter((id) => order.includes(id)),
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

  addServer: async (url: string, apiKey: string, label?: string) => {
    const normalised = url.replace(/\/+$/, '')
    const id = serverIdFromUrl(normalised)

    await SecureStore.setItemAsync(secureKeyForServer(id), apiKey)

    const config: ServerConfig = {
      id,
      url: normalised,
      apiKey,
      label,
      isConnected: false,
      serverInfo: null,
    }

    set((state) => {
      const servers = { ...state.servers, [id]: config }
      const activeServerIds = state.activeServerIds.includes(id)
        ? state.activeServerIds
        : [...state.activeServerIds, id]
      const displayedServerIds = state.displayedServerIds.includes(id)
        ? state.displayedServerIds
        : [...state.displayedServerIds, id]
      // Persist asynchronously (fire-and-forget from set callback)
      persistServerList(servers, activeServerIds, displayedServerIds)
      return { servers, activeServerIds, displayedServerIds }
    })

    return id
  },

  removeServer: async (serverId: string) => {
    await SecureStore.deleteItemAsync(secureKeyForServer(serverId))

    set((state) => {
      const { [serverId]: _removed, ...servers } = state.servers
      const activeServerIds = state.activeServerIds.filter((id) => id !== serverId)
      const prunedDisplayed = state.displayedServerIds.filter((id) => activeServerIds.includes(id))
      const displayedServerIds = prunedDisplayed.length > 0
        ? prunedDisplayed
        : defaultDisplayedServerIds(activeServerIds)
      persistServerList(servers, activeServerIds, displayedServerIds)
      return { servers, activeServerIds, displayedServerIds }
    })
  },

  setDisplayedServerIds: (ids: string[]) => {
    set((state) => {
      const displayedServerIds = toValidUniqueIds(ids, state.activeServerIds)
      persistServerList(state.servers, state.activeServerIds, displayedServerIds)
      return { displayedServerIds }
    })
  },

  updateServerLabel: (serverId: string, label: string) => {
    set((state) => {
      const server = state.servers[serverId]
      if (!server) return state
      const servers = { ...state.servers, [serverId]: { ...server, label } }
      persistServerList(servers, state.activeServerIds, state.displayedServerIds)
      return { servers }
    })
  },

  setConnected: (serverId: string, connected: boolean, info?: ServerInfo) => {
    set((state) => {
      const server = state.servers[serverId]
      if (!server) return state
      return {
        servers: {
          ...state.servers,
          [serverId]: { ...server, isConnected: connected, serverInfo: info ?? server.serverInfo },
        },
      }
    })
  },

  loadPersistedServers: async () => {
    set({ isLoading: true })
    try {
      const AsyncStorage = await getAsyncStorage()

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
          servers[entry.id] = {
            id: entry.id,
            url: entry.url,
            apiKey,
            label: entry.label,
            isConnected: false,
            serverInfo: null,
          }
          activeServerIds.push(entry.id)
        }

        const validDisplayed = (persistedDisplayed ?? []).filter((id) => activeServerIds.includes(id))
        const displayedServerIds = validDisplayed.length > 0
          ? validDisplayed
          : defaultDisplayedServerIds(activeServerIds)
        set({ servers, activeServerIds, displayedServerIds })
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
        }

        const servers = { [id]: config }
        const activeServerIds = [id]
        const displayedServerIds = defaultDisplayedServerIds(activeServerIds)
        await persistServerList(servers, activeServerIds, displayedServerIds)

        // Clean up legacy keys
        await SecureStore.deleteItemAsync(LEGACY_SECURE_KEY)
        await AsyncStorage.removeItem(LEGACY_ASYNC_KEY)

        set({ servers, activeServerIds, displayedServerIds })
      }
    } finally {
      set({ isLoading: false })
    }
  },
}))
