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
  /** Server-supplied error code, when the response carried one. */
  code?: string
  message: string
}

interface LoadingStateStore {
  slowCounts: Record<QueryCategory, number>
  errors: QueryError[]
  /** Categories the user closed the banner on; suppressed until they recover. */
  dismissed: QueryCategory[]
  incrementSlow: (category: QueryCategory) => void
  decrementSlow: (category: QueryCategory) => void
  pushError: (error: Omit<QueryError, 'id'>) => void
  /** `sticky` marks the category suppressed — for a close, never for a retry. */
  dismissError: (id: string, sticky?: boolean) => void
  clearDismissed: (category: QueryCategory) => void
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
  dismissed: [],

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
  // A category the user closed stays closed until it succeeds again. Without
  // this, returning from the background refetches every query, each failure
  // re-pushes, and the banner the user just dismissed is back on screen.
  pushError: (error) =>
    set((s) => {
      if (s.dismissed.includes(error.category)) {
        // still clear the slow indicator — the query settled, it just errored
        return { slowCounts: { ...s.slowCounts, [error.category]: 0 } }
      }
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

  dismissError: (id, sticky = false) =>
    set((s) => {
      const errors = s.errors.filter((e) => e.id !== id)
      if (!sticky) return { errors }
      const category = s.errors.find((e) => e.id === id)?.category
      if (!category || s.dismissed.includes(category)) return { errors }
      return { errors, dismissed: [...s.dismissed, category] }
    }),

  clearDismissed: (category) =>
    set((s) => {
      if (!s.dismissed.includes(category)) return s
      return { dismissed: s.dismissed.filter((c) => c !== category) }
    }),
}))
