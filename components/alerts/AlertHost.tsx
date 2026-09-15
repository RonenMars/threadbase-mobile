import { StatusSheet } from '@/components/alerts/StatusSheet'
import { useAlertAnnouncements } from '@/hooks/useAlertAnnouncements'
import { useRequestFailureAlerts } from '@/hooks/useRequestFailureAlerts'

export function AlertHost() {
  useAlertAnnouncements()
  useRequestFailureAlerts()
  return <StatusSheet />
}
