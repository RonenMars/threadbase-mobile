import { create } from 'zustand'

interface SlowQueryStore {
  slowCount: number
  increment: () => void
  decrement: () => void
}

export const useSlowQueryStore = create<SlowQueryStore>((set) => ({
  slowCount: 0,
  increment: () => set((s) => ({ slowCount: s.slowCount + 1 })),
  decrement: () => set((s) => ({ slowCount: Math.max(0, s.slowCount - 1) })),
}))
