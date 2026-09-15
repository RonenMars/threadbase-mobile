import { useCallback } from 'react'
import { useFocusEffect } from 'expo-router'
import { useAlertStore } from '@/stores/alerts'
import type { AlertCause } from '@/types/alerts'

/** Claims `causes` while this screen is focused so the pill/strip hide them. */
export function useClaimInline(causes: readonly AlertCause[]) {
  const claimInline = useAlertStore((s) => s.claimInline)
  const releaseInline = useAlertStore((s) => s.releaseInline)
  const key = causes.join('\0')

  useFocusEffect(
    useCallback(() => {
      const claimed = key.length === 0 ? [] : key.split('\0') as AlertCause[]
      for (const cause of claimed) claimInline(cause)
      return () => {
        for (const cause of claimed) releaseInline(cause)
      }
    }, [key, claimInline, releaseInline]),
  )
}
