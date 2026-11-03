import { useCallback } from 'react'
import { arbitrate, globalSurface } from '@/lib/alertArbitration'
import { useAlertStore } from '@/stores/alerts'
import { useErrorSheetStore } from '@/stores/errorSheet'

// An on-screen banner claims its own cause, which takes that error out of
// `global` — so a screen showing one inline leaves globalSurface() with nothing
// to report and the sheet with nothing to show. Falling back to the servers
// modal keeps "which one is down" answerable; doing nothing made the control a
// silent no-op, which is what this hook exists to prevent.
//
// The alert store is read when the control is pressed, not subscribed to: the
// screens that call this (the Hub above all) would otherwise re-render on every
// alert write just to keep a press handler current.
export function useOpenStatusSurface() {
  const openSheet = useErrorSheetStore((s) => s.openSheet)
  const setServersStatusOpen = useErrorSheetStore((s) => s.setServersStatusOpen)

  return useCallback(() => {
    const { alerts, inlineClaims } = useAlertStore.getState()
    const surface = globalSurface(arbitrate(alerts, inlineClaims))
    if (surface === 'error' || surface === 'warning') {
      openSheet()
      return
    }
    setServersStatusOpen(true)
  }, [openSheet, setServersStatusOpen])
}
