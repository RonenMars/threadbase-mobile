import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAlertListSync } from '@/hooks/useAlertSync'
import { selectIsBlockingRecovery, selectIsRecovering, useQueryRecoveryStore } from '@/stores/query-recovery'
import { useServersStore } from '@/stores/servers'
import type { AlertInput } from '@/stores/alerts'
import { queryCause } from '@/types/alerts'

const RECOVERY_ALERT_ID = 'query-recovery'

/**
 * Silent RQ retry: warning Status pill only (no error copy yet). A single-server
 * first load uses RecoveryOverlay via RecoveryHost instead.
 */
export function useQueryRecoveryAlerts() {
  const recovering = useQueryRecoveryStore(selectIsRecovering)
  const blocking = useQueryRecoveryStore(selectIsBlockingRecovery)
  const serverCount = useServersStore((s) => Object.keys(s.servers).length)
  const { t } = useTranslation('common')

  const showPill = recovering && (serverCount > 1 || !blocking)

  const alerts = useMemo((): AlertInput[] => {
    if (!showPill) return []
    return [{
      id: RECOVERY_ALERT_ID,
      cause: queryCause('recovery'),
      level: 'warning',
      title: t('recovery.title'),
      message: t('recovery.message'),
      retrying: true,
      hideCloseButton: true,
    }]
  }, [showPill, t])

  useAlertListSync(alerts)
}
