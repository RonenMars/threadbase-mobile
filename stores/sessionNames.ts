import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

const SECURE_KEY = 'threadbase_session_names'

export type NameOrigin = 'manual' | 'auto' | 'ai'

function sessionKey(serverId: string, sessionId: string): string {
  return `${serverId}::${sessionId}`
}

interface SessionNamesStore {
  names: Record<string, string>
  nameOrigin: Record<string, NameOrigin>
  getName: (serverId: string, sessionId: string) => string | undefined
  getOrigin: (serverId: string, sessionId: string) => NameOrigin | undefined
  setName: (serverId: string, sessionId: string, name: string, origin: NameOrigin) => void
  mergeFromServer: (serverId: string, serverNames: Record<string, string>) => void
  hydrate: () => Promise<void>
}

export const useSessionNamesStore = create<SessionNamesStore>((set, get) => ({
  names: {},
  nameOrigin: {},

  getName: (serverId, sessionId) => get().names[sessionKey(serverId, sessionId)],

  getOrigin: (serverId, sessionId) => get().nameOrigin[sessionKey(serverId, sessionId)],

  setName: (serverId, sessionId, name, origin) => {
    const key = sessionKey(serverId, sessionId)
    const names = { ...get().names, [key]: name }
    const nameOrigin = { ...get().nameOrigin, [key]: origin }
    set({ names, nameOrigin })
    void SecureStore.setItemAsync(SECURE_KEY, JSON.stringify({ names, nameOrigin }))
  },

  mergeFromServer: (serverId, serverNames) => {
    const { names, nameOrigin } = get()
    const merged = { ...names }
    const mergedOrigins = { ...nameOrigin }
    let changed = false
    for (const [sessionId, name] of Object.entries(serverNames)) {
      const key = sessionKey(serverId, sessionId)
      if (mergedOrigins[key] !== 'manual') {
        merged[key] = name
        mergedOrigins[key] = mergedOrigins[key] ?? 'auto'
        changed = true
      }
    }
    if (!changed) return
    set({ names: merged, nameOrigin: mergedOrigins })
    void SecureStore.setItemAsync(SECURE_KEY, JSON.stringify({ names: merged, nameOrigin: mergedOrigins }))
  },

  hydrate: async () => {
    const raw = await SecureStore.getItemAsync(SECURE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as { names: Record<string, string>; nameOrigin: Record<string, NameOrigin> }
      set({ names: parsed.names ?? {}, nameOrigin: parsed.nameOrigin ?? {} })
    } catch {
      // corrupted — ignore
    }
  },
}))
