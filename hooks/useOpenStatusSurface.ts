import { useCallback } from 'react'
import { globalSurface } from '@/lib/alertArbitration'
import { useArbitratedAlerts } from '@/hooks/useArbitratedAlerts'
import { useErrorSheetStore } from '@/stores/errorSheet'

// An on-screen banner claims its own cause, which takes that error out of
// `global` — so a screen showing one inline leaves globalSurface() with nothing
// to report and the sheet with nothing to show. Falling back to the servers
// modal keeps "which one is down" answerable; doing nothing made the control a
// silent no-op, which is what this hook exists to prevent.
export function useOpenStatusSurface() {
  const arb = useArbitratedAlerts()
  const openSheet = useErrorSheetStore((s) => s.openSheet)
  const setServersStatusOpen = useErrorSheetStore((s) => s.setServersStatusOpen)

  return useCallback(() => {
    const surface = globalSurface(arb)
    if (surface === 'error' || surface === 'warning') {
      openSheet()
      return
    }
    setServersStatusOpen(true)
  }, [arb, openSheet, setServersStatusOpen])
}
