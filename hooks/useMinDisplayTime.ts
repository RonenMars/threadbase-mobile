import { useEffect, useRef, useState } from 'react'

/**
 * Holds a loading state for a minimum display duration, gated on a readiness signal.
 *
 * Returns `isGated = !(floorElapsed && isReady)`. Caller renders the loader while gated.
 *
 * The timer resets when `resetKey` changes — use the route param that identifies the
 * resource so navigating to a different one re-gates.
 *
 * `minMs <= 0` short-circuits to `!isReady` (no timer scheduled).
 */
export function useMinDisplayTime(
  isReady: boolean,
  minMs: number = 1200,
  resetKey?: string | number,
): boolean {
  // Synchronous re-gate when resetKey changes — store the last key alongside
  // the floorElapsed flag so we can detect a change during render and reset
  // without setState-in-effect (which would defer the re-gate by one render).
  const [state, setState] = useState<{ key: string | number | undefined; floorElapsed: boolean }>(() => ({
    key: resetKey,
    floorElapsed: minMs <= 0,
  }))
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Detect resetKey change during render — this is the React-blessed pattern
  // for "reset state when a key changes" (see https://react.dev/reference/react/useState#storing-information-from-previous-renders).
  let floorElapsed = state.floorElapsed
  if (state.key !== resetKey) {
    floorElapsed = minMs <= 0
    setState({ key: resetKey, floorElapsed })
  }

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (minMs <= 0) return
    timerRef.current = setTimeout(() => {
      setState((s) => ({ ...s, floorElapsed: true }))
      timerRef.current = null
    }, minMs)
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [resetKey, minMs])

  if (minMs <= 0) return !isReady
  return !(floorElapsed && isReady)
}
