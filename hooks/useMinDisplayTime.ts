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
  const [floorElapsed, setFloorElapsed] = useState(minMs <= 0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (minMs <= 0) {
      setFloorElapsed(true)
      return
    }
    setFloorElapsed(false)
    timerRef.current = setTimeout(() => {
      setFloorElapsed(true)
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
