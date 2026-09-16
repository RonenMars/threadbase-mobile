import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAlertSync } from '@/hooks/useAlertSync'
import { useLoadingStateStore } from '@/stores/loading-state'
import { queryCause, type AlertSpec } from '@/types/alerts'

const TOAST_ID = 'slow-query'

export function SlowQueryBanner() {
  const { t } = useTranslation('sessions')
  const isSlow = useLoadingStateStore((s) => s.slowCounts.sessions > 0 || s.slowCounts.other > 0)
  const spec = useMemo((): AlertSpec | null => {
    if (!isSlow) return null
    return {
      cause: queryCause('slow'),
      level: 'warning',
      title: t('slowLoading.sessionsTitle'),
      message: t('slowLoading.sessionsMessage'),
      timeout: null,
      hideCloseButton: true,
    }
  }, [isSlow, t])

  useAlertSync(TOAST_ID, spec)
  return null
}
