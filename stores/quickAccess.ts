import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

const ASYNC_KEY = 'threadbase_quick_access'

export interface FavoriteItem {
  type: 'dir' | 'session'
  id: string
  label: string
  serverId?: string
}

interface PersistedState {
  favorites: FavoriteItem[]
  ignoredRecents: string[]
  ignoredPopular: string[]
  stripCollapsed: boolean
  favoritesEnabled: boolean
  recentsEnabled: boolean
  popularEnabled: boolean
}

interface QuickAccessStore extends PersistedState {
  pinItem: (item: FavoriteItem) => void
  unpinItem: (id: string) => void
  reorderFavorites: (from: number, to: number) => void
  ignoreRecent: (id: string) => void
  ignorePopular: (id: string) => void
  setStripCollapsed: (v: boolean) => void
  setFavoritesEnabled: (v: boolean) => void
  setRecentsEnabled: (v: boolean) => void
  setPopularEnabled: (v: boolean) => void
  hydrate: () => Promise<void>
}

const DEFAULTS: PersistedState = {
  favorites: [],
  ignoredRecents: [],
  ignoredPopular: [],
  stripCollapsed: false,
  favoritesEnabled: true,
  recentsEnabled: true,
  popularEnabled: true,
}

export const useQuickAccessStore = create<QuickAccessStore>((set, get) => ({
  ...DEFAULTS,

  pinItem: (item) =>
    set((s) => {
      if (s.favorites.some((f) => f.id === item.id)) return s
      return { favorites: [...s.favorites, item] }
    }),

  unpinItem: (id) =>
    set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) })),

  reorderFavorites: (from, to) =>
    set((s) => {
      const next = [...s.favorites]
      const [item] = next.splice(from, 1)
      next.splice(to > from ? to - 1 : to, 0, item)
      return { favorites: next }
    }),

  ignoreRecent: (id) =>
    set((s) => ({
      ignoredRecents: s.ignoredRecents.includes(id) ? s.ignoredRecents : [...s.ignoredRecents, id],
    })),

  ignorePopular: (id) =>
    set((s) => ({
      ignoredPopular: s.ignoredPopular.includes(id) ? s.ignoredPopular : [...s.ignoredPopular, id],
    })),

  setStripCollapsed: (stripCollapsed) => set({ stripCollapsed }),
  setFavoritesEnabled: (favoritesEnabled) => set({ favoritesEnabled }),
  setRecentsEnabled: (recentsEnabled) => set({ recentsEnabled }),
  setPopularEnabled: (popularEnabled) => set({ popularEnabled }),

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(ASYNC_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<PersistedState>
      set((s) => ({
        favorites: Array.isArray(parsed.favorites) ? parsed.favorites : s.favorites,
        ignoredRecents: Array.isArray(parsed.ignoredRecents) ? parsed.ignoredRecents : s.ignoredRecents,
        ignoredPopular: Array.isArray(parsed.ignoredPopular) ? parsed.ignoredPopular : s.ignoredPopular,
        stripCollapsed: parsed.stripCollapsed ?? s.stripCollapsed,
        favoritesEnabled: parsed.favoritesEnabled ?? s.favoritesEnabled,
        recentsEnabled: parsed.recentsEnabled ?? s.recentsEnabled,
        popularEnabled: parsed.popularEnabled ?? s.popularEnabled,
      }))
    } catch {
      // storage unavailable or corrupted — ignore
    }
  },
}))

useQuickAccessStore.subscribe((state) => {
  const payload: PersistedState = {
    favorites: state.favorites,
    ignoredRecents: state.ignoredRecents,
    ignoredPopular: state.ignoredPopular,
    stripCollapsed: state.stripCollapsed,
    favoritesEnabled: state.favoritesEnabled,
    recentsEnabled: state.recentsEnabled,
    popularEnabled: state.popularEnabled,
  }
  void AsyncStorage.setItem(ASYNC_KEY, JSON.stringify(payload))
})
