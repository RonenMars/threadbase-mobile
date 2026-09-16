import React, { useMemo } from 'react'
import { Toast } from '@/components/ui/Toast'
import { arbitrate, globalSurface, type ArbitratedAlerts } from '@/lib/alertArbitration'
import { useAlertStore } from '@/stores/alerts'
import type { AlertEntry } from '@/types/alerts'

export function infoToasts(arb: ArbitratedAlerts): AlertEntry[] {
  if (globalSurface(arb) !== 'info') return []
  const first = arb.infos[0]
  return first ? [first] : []
}

export function ToastViewport() {
  const alerts = useAlertStore((s) => s.alerts)
  const inlineClaims = useAlertStore((s) => s.inlineClaims)
  const arb = useMemo(() => arbitrate(alerts, inlineClaims), [alerts, inlineClaims])
  const visible = infoToasts(arb)

  return (
    <>
      {visible.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </>
  )
}
