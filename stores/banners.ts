import { create } from 'zustand'
import type { AlertSpec } from '@/types/alerts'

export type BannerEntry = AlertSpec & {
  id: string
}

type BannerState = {
  banners: BannerEntry[]
  upsert: (entry: BannerEntry) => void
  dismiss: (id: string) => void
  reset: () => void
}

export const useBannerStore = create<BannerState>((set, get) => ({
  banners: [],
  // Always replaces rather than refreshing callbacks in place: BannerHost hands
  // `buttonAction`/`onClose` to Banner as props, so a silent in-place swap would
  // leave Banner rendering the closures it captured last time — a Retry button
  // that retries an error already gone from the list.
  upsert: (entry) => {
    const banners = get().banners
    const index = banners.findIndex((banner) => banner.id === entry.id)
    if (index === -1) {
      set({ banners: [...banners, entry] })
      return
    }
    const next = banners.slice()
    next[index] = entry
    set({ banners: next })
  },
  dismiss: (id) => {
    if (!get().banners.some((banner) => banner.id === id)) return
    set({ banners: get().banners.filter((banner) => banner.id !== id) })
  },
  reset: () => set({ banners: [] }),
}))
