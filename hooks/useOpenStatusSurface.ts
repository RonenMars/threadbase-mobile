import { useCallback } from 'react'
import { globalSurface } from '@/lib/alertArbitration'
import { useArbitratedAlerts } from '@/hooks/useArbitratedAlerts'
import { useErrorSheetStore } from '@/stores/errorSheet'

export function useOpenStatusSurface(fallback?: () => void) {
  const arb = useArbitratedAlerts()
  const openSheet = useErrorSheetStore((s) => s.openSheet)

  return useCallback(() => {
    const surface = globalSurface(arb)
    if (surface === 'error') {
      openSheet()
      return
    }
    const warning = arb.warnings[0]
    if (warning?.onPress) {
      warning.onPress()
      return
    }
    if (warning?.buttonAction) {
      warning.buttonAction()
      return
    }
    fallback?.()
  }, [arb, fallback, openSheet])
}
