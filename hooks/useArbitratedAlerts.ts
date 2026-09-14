import { useMemo } from 'react'
import { arbitrate, type ArbitratedAlerts } from '@/lib/alertArbitration'
import { useAlertStore } from '@/stores/alerts'

export function useArbitratedAlerts(): ArbitratedAlerts {
  const alerts = useAlertStore((s) => s.alerts)
  const inlineClaims = useAlertStore((s) => s.inlineClaims)
  return useMemo(() => arbitrate(alerts, inlineClaims), [alerts, inlineClaims])
}
