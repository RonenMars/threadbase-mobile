import type { TFunction } from 'i18next'
import type { AlertLevel } from '@/types/alerts'

export function getAlertLevelLabel(level: AlertLevel, t: TFunction<'common'>): string {
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

export function getStatusPillCaption(
  surface: 'error' | 'warning',
  issueCount: number,
  t: TFunction<'common'>,
): string {
  switch (surface) {
    case 'error':
      return t('alert.pill.issues', { count: issueCount })
    case 'warning':
      return t('alert.pill.degraded')
  }
}

export function getStatusSummary(
  errorCount: number,
  warningCount: number,
  t: TFunction<'common'>,
): string {
  if (errorCount > 0 && warningCount > 0) {
    return t('alert.status.summaryBoth', {
      errors: t('alert.status.errorCount', { count: errorCount }),
      warnings: t('alert.status.warningCount', { count: warningCount }),
    })
  }
  if (errorCount > 0) return t('alert.status.errorCount', { count: errorCount })
  return t('alert.status.warningCount', { count: warningCount })
}
