import { useEffect, useRef } from 'react'
import { AccessibilityInfo } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useArbitratedAlerts } from '@/hooks/useArbitratedAlerts'
import { getAlertLevelLabel } from '@/lib/alertLabels'
import type { AlertCause, AlertLevel } from '@/types/alerts'

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
