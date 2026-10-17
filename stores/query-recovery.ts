import { create } from 'zustand'

interface State {
  /** True while at least one query is in a silent RQ retry window. */
  recovering: boolean
  /** In-flight per-server silent retries (Hub list fetches that catch inside the queryFn). */
  nestedRetryCount: number
}

interface Actions {
  setRecovering: (recovering: boolean) => void
  beginNestedRetry: () => void
  endNestedRetry: () => void
}

function publish(recovering: boolean, nestedRetryCount: number): boolean {
  return recovering || nestedRetryCount > 0
}

export const useQueryRecoveryStore = create<State & Actions>((set, get) => ({
  recovering: false,
  nestedRetryCount: 0,
  setRecovering: (recovering) => {
    const cur = get()
    if (cur.recovering === recovering) return
    set({ recovering })
  },
  beginNestedRetry: () => {
    set((s) => ({ nestedRetryCount: s.nestedRetryCount + 1 }))
  },
  endNestedRetry: () => {
    set((s) => ({ nestedRetryCount: Math.max(0, s.nestedRetryCount - 1) }))
  },
}))

/** Overlay / pill should show for RQ retries or nested per-server retries. */
export function selectIsRecovering(s: State): boolean {
  return publish(s.recovering, s.nestedRetryCount)
}
