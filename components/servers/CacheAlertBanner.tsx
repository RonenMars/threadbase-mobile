import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAlertListSync } from '@/hooks/useAlertSync'
import { useServersStore } from '@/stores/servers'
import { cacheCause, type AlertSpec } from '@/types/alerts'
import type { AlertInput } from '@/stores/alerts'

interface Props {
  onPress: (serverId: string) => void
}

export function CacheAlertBanner({ onPress }: Props) {
  const { t } = useTranslation('servers')
  const servers = useServersStore((s) => s.servers)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const cacheAlert = useServersStore((s) => s.cacheAlert)

  const entries = useMemo((): AlertInput[] => {
    return displayedServerIds.flatMap((serverId): AlertInput[] => {
      const alert = cacheAlert[serverId]
      if (!alert) return []
      const serverLabel = servers[serverId]?.label || servers[serverId]?.url || serverId
      const spec: AlertSpec = {
        cause: cacheCause(serverId),
        level: alert.severity === 'high' ? 'error' : 'warning',
        title: t('cacheAlert.bannerTitle', { count: alert.missingCount, server: serverLabel }),
        message: t('cacheAlert.toastMessage'),
        details: t('cacheAlert.toastDetails', { count: alert.missingCount }),
        timeout: null,
        hideCloseButton: true,
        buttonText: t('cacheAlert.review'),
        buttonAction: () => onPress(serverId),
      }
      return [{ ...spec, id: `cache-alert:${serverId}` }]
    })
  }, [cacheAlert, displayedServerIds, onPress, servers, t])

  useAlertListSync(entries)
  return null
}
