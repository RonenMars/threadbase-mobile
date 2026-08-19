import React from 'react'
import { AlertDetailsModal } from '@/components/ui/AlertDetailsModal'
import { Toast } from '@/components/ui/Toast'
import { useToastStore } from '@/stores/toasts'

type Props = {
  id?: string
}

export function ToastViewport({ id }: Props) {
  const toasts = useToastStore((s) => s.toasts)
  const detailsId = useToastStore((s) => s.detailsId)
  const openDetails = useToastStore((s) => s.openDetails)
  const closeDetails = useToastStore((s) => s.closeDetails)
  const stickyDismiss = useToastStore((s) => s.stickyDismiss)
  const visible = id ? toasts.filter((toast) => toast.viewport === id) : toasts
  const detailsToast = visible.find((toast) => toast.id === detailsId)

  return (
    <>
      {visible.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          onOpenDetails={() => openDetails(toast.id)}
          onDismiss={() => stickyDismiss(toast.id)}
        />
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
