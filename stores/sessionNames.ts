import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

const SECURE_KEY = 'threadbase_session_names'

type NameOrigin = 'manual' | 'auto' | 'ai'

function sessionKey(serverId: string, sessionId: string): string {
  return `${serverId}::${sessionId}`
}

interface SessionNamesStore {
  names: Record<string, string>
  nameOrigins: Record<string, NameOrigin>
  getName: (serverId: string, sessionId: string) => string | undefined
  getOrigin: (serverId: string, sessionId: string) => NameOrigin | undefined
  setName: (serverId: string, sessionId: string, name: string, origin: NameOrigin) => void
  mergeFromServer: (serverId: string, serverNames: Record<string, string>) => void
  hydrate: () => Promise<void>
}

export const useSessionNamesStore = create<SessionNamesStore>((set, get) => ({
  names: {},
  nameOrigins: {},

  getName: (serverId, sessionId) => get().names[sessionKey(serverId, sessionId)],

  getOrigin: (serverId, sessionId) => get().nameOrigins[sessionKey(serverId, sessionId)],

  setName: (serverId, sessionId, name, origin) => {
    const key = sessionKey(serverId, sessionId)
    const names = { ...get().names, [key]: name }
    const nameOrigins = { ...get().nameOrigins, [key]: origin }
    set({ names, nameOrigins })
    void SecureStore.setItemAsync(SECURE_KEY, JSON.stringify({ names, nameOrigins }))
  },

  mergeFromServer: (serverId, serverNames) => {
    const { names, nameOrigins } = get()
    const merged = { ...names }
    const mergedOrigins = { ...nameOrigins }
    for (const [sessionId, name] of Object.entries(serverNames)) {
      const key = sessionKey(serverId, sessionId)
      if (mergedOrigins[key] !== 'manual') {
        merged[key] = name
        mergedOrigins[key] = mergedOrigins[key] ?? 'auto'
      }
    }
    set({ names: merged, nameOrigins: mergedOrigins })
    void SecureStore.setItemAsync(SECURE_KEY, JSON.stringify({ names: merged, nameOrigins: mergedOrigins }))
  },

  hydrate: async () => {
    const raw = await SecureStore.getItemAsync(SECURE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as { names: Record<string, string>; nameOrigins: Record<string, NameOrigin> }
      set({ names: parsed.names ?? {}, nameOrigins: parsed.nameOrigins ?? {} })
    } catch {
      // corrupted — ignore
    }
  },
}))
