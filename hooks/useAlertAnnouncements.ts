import { useEffect, useRef } from 'react'
import { AccessibilityInfo } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useArbitratedAlerts } from '@/hooks/useArbitratedAlerts'
import type { AlertCause, AlertLevel } from '@/types/alerts'

function getAlertLevelLabel(level: AlertLevel, t: TFunction<'common'>): string {
  switch (level) {
    case 'critical':
      return t('alert.level.critical')
    case 'error':
      return t('alert.level.error')
    case 'warning':
      return t('alert.level.warning')
    case 'info':
      return t('alert.level.info')
  }
}

export function useAlertAnnouncements() {
  const { t } = useTranslation('common')
  const arbitrated = useArbitratedAlerts()
  const announcedRef = useRef(new Map<AlertCause, AlertLevel>())

  useEffect(() => {
    const currentCauses = new Set(arbitrated.all.map((alert) => alert.cause))
    for (const cause of [...announcedRef.current.keys()]) {
      if (!currentCauses.has(cause)) announcedRef.current.delete(cause)
    }

    for (const entry of arbitrated.all) {
      if (entry.level !== 'critical' && entry.level !== 'error') continue
      if (announcedRef.current.get(entry.cause) === entry.level) continue
      announcedRef.current.set(entry.cause, entry.level)
      const levelLabel = getAlertLevelLabel(entry.level, t)
      AccessibilityInfo.announceForAccessibility(`${levelLabel}. ${entry.title}`)
    }
  }, [arbitrated, t])
}
