import { StatusSheet } from '@/components/alerts/StatusSheet'
import { CriticalDialog, type CriticalAction } from '@/components/alerts/CriticalDialog'
import { SlowQueryBanner } from '@/components/SlowQueryBanner'
import { useAlertAnnouncements } from '@/hooks/useAlertAnnouncements'
import { useRequestFailureAlerts } from '@/hooks/useRequestFailureAlerts'
import { useArbitratedAlerts } from '@/hooks/useArbitratedAlerts'
import { useAlertStore } from '@/stores/alerts'
import { useTranslation } from 'react-i18next'

function CriticalDialogHost() {
  const { t } = useTranslation('common')
  const critical = useArbitratedAlerts().critical
  const dismiss = useAlertStore((s) => s.dismiss)
  if (!critical) return null

  const close = () => {
    critical.onClose?.()
    dismiss(critical.id)
  }
  const actions: CriticalAction[] = [{
    label: t('button.close'),
    onPress: close,
    variant: 'secondary',
    testID: 'critical-dialog-close',
  }]
  if (critical.buttonText && critical.buttonAction) {
    const run = critical.buttonAction
    actions.push({
      label: critical.buttonText,
      onPress: () => {
        run()
        dismiss(critical.id)
      },
      variant: critical.buttonVariant ?? 'primary',
      testID: 'critical-dialog-action',
    })
  }

  return (
    <CriticalDialog
      visible
      title={critical.title}
      message={critical.message}
      onRequestClose={close}
      actions={actions}
    />
  )
}

export function AlertHost() {
  useAlertAnnouncements()
  useRequestFailureAlerts()
  return (
    <>
      <SlowQueryBanner />
      <CriticalDialogHost />
      <StatusSheet />
    </>
  )
}
