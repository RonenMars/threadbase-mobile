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
  // Now tab's single-server "earlier" day buckets currently collapsed.
  // Default = only last7Days expanded.
  collapsedDayBuckets: string[]
}

interface ViewPrefsStore extends PersistedState {
  toggleServerCollapsed: (serverId: string) => void
  setRecentsOpen: (open: boolean) => void
  setSessionsHeaderCollapsed: (collapsed: boolean) => void
  toggleDayBucketCollapsed: (bucket: string) => void
  hydrate: () => Promise<void>
}

const DEFAULTS: PersistedState = {
  collapsedServers: [],
  recentsOpen: true,
  sessionsHeaderCollapsed: null,
  collapsedDayBuckets: ['last14Days', 'lastMonth', 'earlier'],
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

  toggleDayBucketCollapsed: (bucket) =>
    set((s) => ({
      collapsedDayBuckets: s.collapsedDayBuckets.includes(bucket)
        ? s.collapsedDayBuckets.filter((b) => b !== bucket)
        : [...s.collapsedDayBuckets, bucket],
    })),

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(VIEW_PREFS_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<PersistedState>
      set((s) => ({
        collapsedServers: Array.isArray(parsed.collapsedServers) ? parsed.collapsedServers : s.collapsedServers,
        recentsOpen: parsed.recentsOpen ?? s.recentsOpen,
        sessionsHeaderCollapsed: parsed.sessionsHeaderCollapsed ?? s.sessionsHeaderCollapsed,
        collapsedDayBuckets: Array.isArray(parsed.collapsedDayBuckets) ? parsed.collapsedDayBuckets : s.collapsedDayBuckets,
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
    collapsedDayBuckets: state.collapsedDayBuckets,
  }
  AsyncStorage.setItem(VIEW_PREFS_STORAGE_KEY, JSON.stringify(payload)).catch(() => {})
})
