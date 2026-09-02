import { create } from 'zustand'

export type QueryCategory =
  | 'sessions'
  | 'conversations'
  | 'messages'
  | 'session-detail'
  | 'browse'
  | 'other'

export interface QueryError {
  id: string
  category: QueryCategory
  status?: number
  message: string
}

interface LoadingStateStore {
  slowCounts: Record<QueryCategory, number>
  errors: QueryError[]
  incrementSlow: (category: QueryCategory) => void
  decrementSlow: (category: QueryCategory) => void
  pushError: (error: Omit<QueryError, 'id'>) => void
  dismissError: (id: string) => void
}

export const useLoadingStateStore = create<LoadingStateStore>((set) => ({
  slowCounts: {
    sessions: 0,
    conversations: 0,
    messages: 0,
    'session-detail': 0,
    browse: 0,
    other: 0,
  },
  errors: [],

  incrementSlow: (category) =>
    set((s) => ({
      slowCounts: { ...s.slowCounts, [category]: s.slowCounts[category] + 1 },
    })),

  decrementSlow: (category) =>
    set((s) => ({
      slowCounts: {
        ...s.slowCounts,
        [category]: Math.max(0, s.slowCounts[category] - 1),
      },
    })),

  // Keyed by category, not per failure: the banner shows one entry per category
  // and its Retry invalidates the whole category key, so a category that fails
  // on 24 queries (or retries 24 times offline) is one banner, not 24.
  pushError: (error) =>
    set((s) => {
      const entry: QueryError = { ...error, id: error.category }
      const index = s.errors.findIndex((e) => e.category === error.category)
      const errors = s.errors.slice()
      if (index === -1) errors.push(entry)
      else errors[index] = entry
      return {
        errors,
        // clear the slow indicator for this category — error supersedes warning
        slowCounts: { ...s.slowCounts, [error.category]: 0 },
      }
    }),

  dismissError: (id) =>
    set((s) => ({ errors: s.errors.filter((e) => e.id !== id) })),
}))
