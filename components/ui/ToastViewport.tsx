import React, { useMemo } from 'react'
import { AlertDetailsModal } from '@/components/ui/AlertDetailsModal'
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
  const detailsId = useAlertStore((s) => s.detailsId)
  const closeDetails = useAlertStore((s) => s.closeDetails)
  const arb = useMemo(() => arbitrate(alerts, inlineClaims), [alerts, inlineClaims])
  const visible = infoToasts(arb)
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
