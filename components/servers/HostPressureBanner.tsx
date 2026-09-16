import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAlertSync } from '@/hooks/useAlertSync'
import { useServersStore } from '@/stores/servers'
import { parseHostPressureOs, type HostPressureLevel } from '@/types/api'
import { hostPressureCause, type AlertSpec } from '@/types/alerts'
import {
  hostPressureDetectedReasons,
  hostPressureServerName,
  hostPressureWhyFineReasons,
  primaryHostConstraint,
} from '@/utils/hostPressureCopy'
import {
  getHostPressureBannerLabel,
  getHostPressureDetectedLabel,
  getHostPressureWhatToDoLabel,
  getHostPressureWhyFineLabel,
} from './hostPressureLabels'

const TOAST_ID = 'host-pressure'

export function HostPressureBanner() {
  const { t } = useTranslation('servers')
  const servers = useServersStore((s) => s.servers)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const hostPressure = useServersStore((s) => s.hostPressure)
  const [dismissed, setDismissed] = useState<{
    serverId: string
    level: HostPressureLevel
  } | null>(null)

  const alertServerId = displayedServerIds.find((id) => hostPressure[id] != null)
  const pressure = alertServerId ? hostPressure[alertServerId] : null

  const handleDismiss = useCallback(() => {
    const state = useServersStore.getState()
    const serverId = state.displayedServerIds.find((id) => state.hostPressure[id] != null)
    const current = serverId ? state.hostPressure[serverId] : null
    if (serverId && current) setDismissed({ serverId, level: current.level })
  }, [])

  const hiddenForLevel = Boolean(
    pressure
    && alertServerId
    && dismissed?.serverId === alertServerId
    && dismissed.level === pressure.level,
  )
  const visible = Boolean(pressure && alertServerId) && !hiddenForLevel

  const spec = useMemo((): AlertSpec | null => {
    if (!visible || !alertServerId || !pressure) return null
    const server = servers[alertServerId]
    const serverLabel = hostPressureServerName(server)
    const title = getHostPressureBannerLabel(
      pressure.level,
      primaryHostConstraint(pressure.reasons),
      serverLabel ?? '',
      t,
    )
    const os = pressure.os ?? parseHostPressureOs(server?.serverInfo?.platform)
    const details = [
      ...hostPressureDetectedReasons(pressure.reasons).map((reason) =>
        getHostPressureDetectedLabel(reason, t),
      ),
      ...hostPressureWhyFineReasons(pressure.reasons).map((reason) =>
        getHostPressureWhyFineLabel(reason, t),
      ),
      pressure.reasons.includes('agents')
        ? t('hostPressure.detected.agents', { count: pressure.liveAgents })
        : null,
      getHostPressureWhatToDoLabel(os, t),
    ].filter((line): line is string => line != null).join('\n\n')
    return {
      cause: hostPressureCause(alertServerId),
      // Critical stays amber like elevated: the stronger wording carries the
      // level, turning it red would read as an app error.
      level: 'warning',
      title,
      message: t('hostPressure.modalLead'),
      details,
      timeout: null,
      hideCloseButton: true,
      buttonText: t('hostPressure.dismiss'),
      buttonAction: handleDismiss,
      testID: 'host-pressure-banner',
    }
  }, [visible, alertServerId, pressure, servers, handleDismiss, t])

  useAlertSync(TOAST_ID, spec)
  return null
}
