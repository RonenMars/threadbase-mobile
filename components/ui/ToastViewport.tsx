import React, { useMemo } from 'react'
import { AlertDetailsModal } from '@/components/ui/AlertDetailsModal'
import { Toast } from '@/components/ui/Toast'
import { arbitrate, globalSurface, type ArbitratedAlerts } from '@/lib/alertArbitration'
import { useAlertStore } from '@/stores/alerts'
import type { AlertEntry } from '@/types/alerts'

type Props = {
  id: string
}

export function toastsForViewport(
  id: string,
  arb: ArbitratedAlerts,
  alerts: readonly AlertEntry[],
): AlertEntry[] {
  // Home is the global surface: info toasts only, and only while nothing
  // higher is occupying the pill. Other viewports (terminal) keep their own
  // chrome until those producers are demoted.
  if (id === 'home') {
    if (globalSurface(arb) !== 'info') return []
    const first = arb.infos.find((alert) => alert.viewport === id)
    return first ? [first] : []
  }
  return alerts.filter((alert) => alert.viewport === id)
}

export function ToastViewport({ id }: Props) {
  const alerts = useAlertStore((s) => s.alerts)
  const inlineClaims = useAlertStore((s) => s.inlineClaims)
  const detailsId = useAlertStore((s) => s.detailsId)
  const closeDetails = useAlertStore((s) => s.closeDetails)
  const arb = useMemo(() => arbitrate(alerts, inlineClaims), [alerts, inlineClaims])
  const visible = toastsForViewport(id, arb, alerts)
  const detailsToast = visible.find((alert) => alert.id === detailsId)

  return (
    <>
      {visible.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
      {detailsToast ? (
        <AlertDetailsModal
          title={detailsToast.title}
          message={detailsToast.message}
          details={detailsToast.details}
          level={detailsToast.level}
          onClose={closeDetails}
        />
      ) : null}
    </>
  )
}
