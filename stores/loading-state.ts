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

  pushError: (error) =>
    set((s) => ({
      errors: [...s.errors, { ...error, id: `${Date.now()}-${Math.random()}` }],
      // clear the slow indicator for this category — error supersedes warning
      slowCounts: { ...s.slowCounts, [error.category]: 0 },
    })),

  dismissError: (id) =>
    set((s) => ({ errors: s.errors.filter((e) => e.id !== id) })),
}))
