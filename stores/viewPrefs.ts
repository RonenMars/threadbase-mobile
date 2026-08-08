import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const VIEW_PREFS_STORAGE_KEY = 'threadbase_view_prefs'

interface PersistedState {
  // Server IDs the user has collapsed in the Tree/Hub views (default = expanded).
  collapsedServers: string[]
  // Browse view "recent directories" accordion (default = open).
  recentsOpen: boolean
  // Live-sessions header, shared by the Tree and Classic views so its collapsed
  // state stays the same across them. `null` = follow the count-based default
  // (collapsed when there are many sessions); a boolean is an explicit choice.
  sessionsHeaderCollapsed: boolean | null
}

interface ViewPrefsStore extends PersistedState {
  toggleServerCollapsed: (serverId: string) => void
  setRecentsOpen: (open: boolean) => void
  setSessionsHeaderCollapsed: (collapsed: boolean) => void
  hydrate: () => Promise<void>
}

const DEFAULTS: PersistedState = {
  collapsedServers: [],
  recentsOpen: true,
  sessionsHeaderCollapsed: null,
}

export const useViewPrefsStore = create<ViewPrefsStore>((set) => ({
  ...DEFAULTS,

  toggleServerCollapsed: (serverId) =>
    set((s) => ({
      collapsedServers: s.collapsedServers.includes(serverId)
        ? s.collapsedServers.filter((id) => id !== serverId)
        : [...s.collapsedServers, serverId],
    })),

  setRecentsOpen: (recentsOpen) => set({ recentsOpen }),

  setSessionsHeaderCollapsed: (sessionsHeaderCollapsed) => set({ sessionsHeaderCollapsed }),

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(VIEW_PREFS_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<PersistedState>
      set((s) => ({
        collapsedServers: Array.isArray(parsed.collapsedServers) ? parsed.collapsedServers : s.collapsedServers,
        recentsOpen: parsed.recentsOpen ?? s.recentsOpen,
        sessionsHeaderCollapsed: parsed.sessionsHeaderCollapsed ?? s.sessionsHeaderCollapsed,
      }))
    } catch {
      // storage unavailable or corrupted — ignore
    }
  },
}))

useViewPrefsStore.subscribe((state) => {
  const payload: PersistedState = {
    collapsedServers: state.collapsedServers,
    recentsOpen: state.recentsOpen,
    sessionsHeaderCollapsed: state.sessionsHeaderCollapsed,
  }
  AsyncStorage.setItem(VIEW_PREFS_STORAGE_KEY, JSON.stringify(payload)).catch(() => {})
})
