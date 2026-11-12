import { useCallback, useEffect, useRef, useState } from 'react'
import * as Clipboard from 'expo-clipboard'

/**
 * Owns the "copied" flag, its revert timer and the timer's cleanup.
 * `copiedMs` is required so each site states its own duration; `null` keeps
 * the flag set until `reset()` is called.
 * `copy` resolves false when the clipboard write fails, so callers can show their own error.
 */
export function useCopyToClipboard(copiedMs: number | null) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = useRef(true)

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimer()
    }
  }, [clearTimer])

  const reset = useCallback(() => {
    clearTimer()
    setCopied(false)
  }, [clearTimer])

  const copy = useCallback(
    async (value: string): Promise<boolean> => {
      try {
        await Clipboard.setStringAsync(value)
      } catch {
        if (mounted.current) reset()
        return false
      }
      // The write can resolve after unmount; a timer armed now would never be cleared.
      if (!mounted.current) return true
      setCopied(true)
      clearTimer()
      if (copiedMs !== null) timer.current = setTimeout(() => setCopied(false), copiedMs)
      return true
    },
    [copiedMs, reset, clearTimer],
  )

  return { copied, copy, reset }
}
