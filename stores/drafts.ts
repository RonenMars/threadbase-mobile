import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

const SECURE_KEY = 'threadbase_session_drafts'

function sessionKey(serverId: string, sessionId: string): string {
  return `${serverId}::${sessionId}`
}

interface DraftsStore {
  drafts: Record<string, string>
  getDraft: (serverId: string, sessionId: string) => string | undefined
  setDraft: (serverId: string, sessionId: string, text: string) => void
  clearDraft: (serverId: string, sessionId: string) => void
  hydrate: () => Promise<void>
}

export const useDraftsStore = create<DraftsStore>((set, get) => ({
  drafts: {},

  getDraft: (serverId, sessionId) => get().drafts[sessionKey(serverId, sessionId)],

  setDraft: (serverId, sessionId, text) => {
    const key = sessionKey(serverId, sessionId)
    const drafts = { ...get().drafts, [key]: text }
    set({ drafts })
    SecureStore.setItemAsync(SECURE_KEY, JSON.stringify(drafts)).catch(() => {})
  },

  clearDraft: (serverId, sessionId) => {
    const key = sessionKey(serverId, sessionId)
    const { [key]: _removed, ...rest } = get().drafts
    set({ drafts: rest })
    void SecureStore.setItemAsync(SECURE_KEY, JSON.stringify(rest))
  },

  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(SECURE_KEY)
      if (!raw) return
      set({ drafts: JSON.parse(raw) as Record<string, string> })
    } catch {
      // keychain unavailable or corrupted — ignore
    }
  },
}))
