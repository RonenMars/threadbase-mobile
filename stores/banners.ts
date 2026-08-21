import { create } from 'zustand'
import { alertFingerprint, type AlertSpec } from '@/types/alerts'

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
  upsert: (entry) => {
    const existing = get().banners.find((banner) => banner.id === entry.id)
    if (existing) {
      const same = alertFingerprint(existing) === alertFingerprint(entry)
      existing.buttonAction = entry.buttonAction
      existing.onPress = entry.onPress
      existing.onClose = entry.onClose
      existing.icon = entry.icon
      existing.buttonText = entry.buttonText
      existing.buttonVariant = entry.buttonVariant
      existing.hideCloseButton = entry.hideCloseButton
      existing.timeout = entry.timeout
      existing.accent = entry.accent
      existing.testID = entry.testID
      if (same) return
      set({
        banners: get().banners.map((banner) => (banner.id === entry.id ? entry : banner)),
      })
      return
    }
    set({ banners: [...get().banners, entry] })
  },
  dismiss: (id) => {
    if (!get().banners.some((banner) => banner.id === id)) return
    set({ banners: get().banners.filter((banner) => banner.id !== id) })
  },
  reset: () => set({ banners: [] }),
}))
