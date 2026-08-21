import React from 'react'
import { AlertDetailsModal } from '@/components/ui/AlertDetailsModal'
import { Toast } from '@/components/ui/Toast'
import { useToastStore } from '@/stores/toasts'

type Props = {
  id: string
}

export function ToastViewport({ id }: Props) {
  const toasts = useToastStore((s) => s.toasts)
  const detailsId = useToastStore((s) => s.detailsId)
  const closeDetails = useToastStore((s) => s.closeDetails)
  const visible = toasts.filter((toast) => toast.viewport === id)
  const detailsToast = visible.find((toast) => toast.id === detailsId)

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
          accent={detailsToast.accent}
          onClose={closeDetails}
        />
      ) : null}
    </>
  )
}
