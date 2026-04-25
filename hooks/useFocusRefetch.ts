import { useCallback, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'

// Triggers `refetch` whenever the screen regains focus, but skips the first
// focus — that one coincides with the screen's initial mount, where React Query
// already fetches via `useQuery({ enabled })`.
//
// `refetch` is captured via a ref so the focus effect re-runs only on actual
// focus changes — not whenever the caller's refetch closure identity shifts.
export function useFocusRefetch(refetch: () => Promise<unknown>): boolean {
  const refetchRef = useRef(refetch)
  refetchRef.current = refetch
  const skippedFirstFocusRef = useRef(false)
  const [isFocusFetching, setIsFocusFetching] = useState(false)

  useFocusEffect(
    useCallback(() => {
      if (!skippedFirstFocusRef.current) {
        skippedFirstFocusRef.current = true
        return
      }
      let cancelled = false
      setIsFocusFetching(true)
      refetchRef.current().finally(() => {
        if (!cancelled) setIsFocusFetching(false)
      })
      return () => {
        cancelled = true
        setIsFocusFetching(false)
      }
    }, []),
  )

  return isFocusFetching
}
