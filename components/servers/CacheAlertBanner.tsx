import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useToastSync } from '@/hooks/useToastSync'
import { useServersStore } from '@/stores/servers'
import type { AlertSpec } from '@/types/alerts'

interface Props {
  onPress: () => void
}

const VIEWPORT = 'home'
const TOAST_ID = 'cache-alert'

export function CacheAlertBanner({ onPress }: Props) {
  const { t } = useTranslation('servers')
  const servers = useServersStore((s) => s.servers)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const cacheAlert = useServersStore((s) => s.cacheAlert)

  const spec = useMemo((): AlertSpec | null => {
    const alertServerId = displayedServerIds.find((id) => cacheAlert[id]?.severity === 'low')
    const alert = alertServerId ? cacheAlert[alertServerId] : null
    if (!alert || !alertServerId) return null

    const serverLabel = servers[alertServerId]?.label || servers[alertServerId]?.url || alertServerId
    return {
      level: 'warning',
      title: t('cacheAlert.bannerTitle', { count: alert.missingCount, server: serverLabel }),
      message: t('cacheAlert.toastMessage'),
      details: t('cacheAlert.toastDetails', { count: alert.missingCount }),
      timeout: null,
      hideCloseButton: true,
      buttonText: t('cacheAlert.review'),
      buttonAction: onPress,
    }
  }, [cacheAlert, displayedServerIds, onPress, servers, t])

  useToastSync(TOAST_ID, spec, VIEWPORT)
  return null
}
