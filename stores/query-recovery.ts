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
  /** The latest request that failed while a retry is pending; names the route in the pill. */
  lastRequest: { serverId: string; method: string; path: string } | null
  /** Set by the session screen while its live socket is reconnecting. */
  wsReconnectServerId: string | null
}

interface Actions {
  setRecovering: (recovering: boolean, blocking: boolean) => void
  beginNestedRetry: (blocking: boolean) => void
  endNestedRetry: (blocking: boolean) => void
  noteFailedRequest: (request: { serverId: string; method: string; path: string }) => void
  setWsReconnectServerId: (serverId: string | null) => void
}

export const useQueryRecoveryStore = create<State & Actions>((set, get) => ({
  recovering: false,
  blockingRecovering: false,
  nestedRetryCount: 0,
  blockingNestedRetryCount: 0,
  lastRequest: null,
  wsReconnectServerId: null,
  setRecovering: (recovering, blocking) => {
    const cur = get()
    if (cur.recovering === recovering && cur.blockingRecovering === blocking) return
    set({ recovering, blockingRecovering: blocking, ...(recovering ? {} : { lastRequest: null }) })
  },
  noteFailedRequest: (lastRequest) => set({ lastRequest }),
  setWsReconnectServerId: (wsReconnectServerId) => set({ wsReconnectServerId }),
  beginNestedRetry: (blocking) => {
    set((s) => ({
      nestedRetryCount: s.nestedRetryCount + 1,
      blockingNestedRetryCount: s.blockingNestedRetryCount + (blocking ? 1 : 0),
    }))
  },
  endNestedRetry: (blocking) => {
    set((s) => {
      const nestedRetryCount = Math.max(0, s.nestedRetryCount - 1)
      return {
        nestedRetryCount,
        blockingNestedRetryCount: Math.max(0, s.blockingNestedRetryCount - (blocking ? 1 : 0)),
        ...(nestedRetryCount === 0 ? { lastRequest: null } : {}),
      }
    })
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
