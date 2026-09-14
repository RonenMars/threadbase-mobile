import React from 'react'
import { AlertDetailsModal } from '@/components/ui/AlertDetailsModal'
import { Toast } from '@/components/ui/Toast'
import { useAlertStore } from '@/stores/alerts'

type Props = {
  id: string
}

export function ToastViewport({ id }: Props) {
  const alerts = useAlertStore((s) => s.alerts)
  const detailsId = useAlertStore((s) => s.detailsId)
  const closeDetails = useAlertStore((s) => s.closeDetails)
  const visible = alerts.filter((alert) => alert.viewport === id)
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
