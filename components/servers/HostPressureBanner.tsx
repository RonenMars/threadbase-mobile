import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useToastSync } from '@/hooks/useToastSync'
import { useServersStore } from '@/stores/servers'
import type { AlertSpec } from '@/types/alerts'
import type { HostPressureReason } from '@/types/api'

const VIEWPORT = 'home'
const TOAST_ID = 'host-pressure'

export function HostPressureBanner() {
  const { t } = useTranslation('servers')
  const servers = useServersStore((s) => s.servers)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const hostPressure = useServersStore((s) => s.hostPressure)

  const spec = useMemo((): AlertSpec | null => {
    const alertServerId = displayedServerIds.find((id) => hostPressure[id] != null)
    const pressure = alertServerId ? hostPressure[alertServerId] : null
    if (!pressure || !alertServerId) return null

    const serverLabel = servers[alertServerId]?.label || servers[alertServerId]?.url || alertServerId
    const title = pressure.level === 'critical'
      ? t('hostPressure.bannerCritical', { server: serverLabel, count: pressure.liveAgents })
      : t('hostPressure.bannerElevated', { server: serverLabel, count: pressure.liveAgents })
    const message = t('hostPressure.sheetBody', {
      server: serverLabel,
      count: pressure.liveAgents,
    })
    const details = pressure.reasons
      .map((reason: HostPressureReason) => t(`hostPressure.reason.${reason}`))
      .join(', ')

    return {
      level: pressure.level === 'critical' ? 'critical' : 'warning',
      title,
      message,
      details: details || undefined,
      timeout: null,
      hideCloseButton: true,
      testID: 'host-pressure-banner',
    }
  }, [displayedServerIds, hostPressure, servers, t])

  useToastSync(TOAST_ID, spec, VIEWPORT)
  return null
}
