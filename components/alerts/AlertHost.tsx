import { ErrorBanner } from '@/components/ErrorBanner'
import { useAlertAnnouncements } from '@/hooks/useAlertAnnouncements'

export function AlertHost() {
  useAlertAnnouncements()
  return <ErrorBanner />
}
