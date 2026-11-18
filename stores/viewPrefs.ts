import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { isDayBucketOpen } from '@/components/sessions/shared/dayBuckets'

export const VIEW_PREFS_STORAGE_KEY = 'threadbase_view_prefs'

interface PersistedState {
  // Server IDs the user has collapsed in the Tree/Hub views (default = expanded).
  collapsedServers: string[]
  // Browse view "recent directories" accordion (default = open).
  recentsOpen: boolean
  // Browse view "pinned" accordion (default = open).
  pinnedOpen: boolean
  // Live-sessions header, shared by the Tree and Classic views so its collapsed
  // state stays the same across them. `null` = follow the count-based default
  // (collapsed when there are many sessions); a boolean is an explicit choice.
  sessionsHeaderCollapsed: boolean | null
  // Now tab / sub-agent board day buckets the user explicitly opened (true) or
  // closed (false). A bucket with no entry follows isDayBucketOpen's default.
  dayBucketOpen: Record<string, boolean>
}

interface ViewPrefsStore extends PersistedState {
  toggleServerCollapsed: (serverId: string) => void
  setRecentsOpen: (open: boolean) => void
  setPinnedOpen: (open: boolean) => void
  setSessionsHeaderCollapsed: (collapsed: boolean) => void
  toggleDayBucket: (bucket: string) => void
  hydrate: () => Promise<void>
}

const DEFAULTS: PersistedState = {
  collapsedServers: [],
  recentsOpen: true,
  pinnedOpen: true,
  sessionsHeaderCollapsed: null,
  dayBucketOpen: {},
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

  setPinnedOpen: (pinnedOpen) => set({ pinnedOpen }),

  setSessionsHeaderCollapsed: (sessionsHeaderCollapsed) => set({ sessionsHeaderCollapsed }),

  toggleDayBucket: (bucket) =>
    set((s) => ({ dayBucketOpen: { ...s.dayBucketOpen, [bucket]: !isDayBucketOpen(s.dayBucketOpen, bucket) } })),

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(VIEW_PREFS_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<PersistedState>
      set((s) => ({
        collapsedServers: Array.isArray(parsed.collapsedServers) ? parsed.collapsedServers : s.collapsedServers,
        recentsOpen: parsed.recentsOpen ?? s.recentsOpen,
        pinnedOpen: parsed.pinnedOpen ?? s.pinnedOpen,
        sessionsHeaderCollapsed: parsed.sessionsHeaderCollapsed ?? s.sessionsHeaderCollapsed,
        dayBucketOpen:
          parsed.dayBucketOpen && typeof parsed.dayBucketOpen === 'object' && !Array.isArray(parsed.dayBucketOpen)
            ? parsed.dayBucketOpen
            : s.dayBucketOpen,
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
    pinnedOpen: state.pinnedOpen,
    sessionsHeaderCollapsed: state.sessionsHeaderCollapsed,
    dayBucketOpen: state.dayBucketOpen,
  }
  AsyncStorage.setItem(VIEW_PREFS_STORAGE_KEY, JSON.stringify(payload)).catch(() => {})
})
