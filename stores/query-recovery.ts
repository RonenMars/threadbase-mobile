import { create } from 'zustand'

interface State {
  /** True while at least one query is in a silent RQ retry window. */
  recovering: boolean
  /** ...and at least one of those queries has no data to show yet. */
  blockingRecovering: boolean
  /** In-flight per-server silent retries (Hub list fetches that catch inside the queryFn). */
  nestedRetryCount: number
  /** The subset of nestedRetryCount whose query has no data to show yet. */
  blockingNestedRetryCount: number
}

interface Actions {
  setRecovering: (recovering: boolean, blocking: boolean) => void
  beginNestedRetry: (blocking: boolean) => void
  endNestedRetry: (blocking: boolean) => void
}

export const useQueryRecoveryStore = create<State & Actions>((set, get) => ({
  recovering: false,
  blockingRecovering: false,
  nestedRetryCount: 0,
  blockingNestedRetryCount: 0,
  setRecovering: (recovering, blocking) => {
    const cur = get()
    if (cur.recovering === recovering && cur.blockingRecovering === blocking) return
    set({ recovering, blockingRecovering: blocking })
  },
  beginNestedRetry: (blocking) => {
    set((s) => ({
      nestedRetryCount: s.nestedRetryCount + 1,
      blockingNestedRetryCount: s.blockingNestedRetryCount + (blocking ? 1 : 0),
    }))
  },
  endNestedRetry: (blocking) => {
    set((s) => ({
      nestedRetryCount: Math.max(0, s.nestedRetryCount - 1),
      blockingNestedRetryCount: Math.max(0, s.blockingNestedRetryCount - (blocking ? 1 : 0)),
    }))
  },
}))

/** Any silent retry in flight: drives the Status pill. */
export function selectIsRecovering(s: State): boolean {
  return s.recovering || s.nestedRetryCount > 0
}

/**
 * A silent retry with nothing on screen yet: drives the full-screen overlay. A
 * refetch of data already shown keeps that data usable instead of covering it.
 */
export function selectIsBlockingRecovery(s: State): boolean {
  return s.blockingRecovering || s.blockingNestedRetryCount > 0
}
