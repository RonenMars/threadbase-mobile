import { create } from 'zustand'
import type { MergedItem } from '@/components/sessions/now/mergedItems'

export interface QuietEntry {
  item: MergedItem
  title: string
}

interface QuietTailStore {
  entries: QuietEntry[]
  set: (entries: QuietEntry[]) => void
  clear: () => void
}

/**
 * Hands a quiet tail's rows to the pushed list. In-memory only, like the
 * drill target: the rows are already loaded on the hub, so the screen reads
 * them from here instead of re-fetching and re-titling them.
 */
export const useQuietTailStore = create<QuietTailStore>((set) => ({
  entries: [],
  set: (entries) => set({ entries }),
  clear: () => set({ entries: [] }),
}))
