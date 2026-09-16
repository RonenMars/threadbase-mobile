import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useAlertListSync } from '@/hooks/useAlertSync'
import { wsManager } from '@/services/ws-client'
import type { AlertInput } from '@/stores/alerts'
import type { ServerFetchStatusEntry } from '@/stores/serverFetchStatus'
import { serverCause, type AlertCause, type AlertLevel, type AlertSpec } from '@/types/alerts'
import type { ServerConfig } from '@/types/api'

type Props = {
  activeServerIds: string[]
  servers: Record<string, ServerConfig>
  fetchStatuses: Record<string, ServerFetchStatusEntry>
  wsConnectedCount: number
  onRetryFailed: (serverId: string) => void
  isRetrying: boolean
}

function serverLabel(id: string, servers: Record<string, ServerConfig>): string {
  const cfg = servers[id]
  if (cfg?.label) return cfg.label
  try { return new URL(cfg?.url ?? '').hostname } catch { return id }
}

type Severity = 'error' | 'warning' | 'info'

type DetailKind = 'unreachable' | 'fetchFailed' | 'disconnected' | 'e2eeProtocolMismatch' | 'connecting' | 'indexing'

function getDetailMessage(detail: DetailKind, t: TFunction<'servers'>): string {
  switch (detail) {
    case 'unreachable':
      return t('state.details.unreachable')
    case 'fetchFailed':
      return t('state.details.fetchFailed')
    case 'disconnected':
      return t('state.details.disconnected')
    case 'e2eeProtocolMismatch':
      return t('state.details.e2eeProtocolMismatch')
    case 'connecting':
      return t('state.details.connecting')
    case 'indexing':
      return t('state.details.indexing')
  }
}

const INFO_DELAY_MS = 2000

function toLevel(severity: Severity): AlertLevel {
  if (severity === 'error') return 'error'
  if (severity === 'warning') return 'warning'
  return 'info'
}

type ServerRow = {
  id: string
  severity: Severity
  message: string
  detailKind: DetailKind
}

function classifyServer(
  id: string,
  servers: Record<string, ServerConfig>,
  fetchStatuses: Record<string, ServerFetchStatusEntry>,
  t: TFunction<'servers'>,
): ServerRow | null {
  const wsStatus = wsManager.status(id)
  const lastError = wsManager.lastError(id)
  const fetchStatus = fetchStatuses[id]?.status ?? 'ok'
  const fetchOk = fetchStatus === 'ok'
  const label = serverLabel(id, servers)

  if (fetchStatus === 'warming_up') {
    return {
      id,
      severity: 'info',
      detailKind: 'indexing',
      message: t('stateMessage.buildingHistoryNamed', { server: label }),
    }
  }
  if (wsStatus === 'connected' && fetchOk) return null
  if (wsStatus === 'disconnected' && !fetchOk) {
    return {
      id,
      severity: 'error',
      detailKind: 'unreachable',
      message: t('stateMessage.unreachableNamed', { server: label }),
    }
  }
  if (wsStatus === 'connected' && !fetchOk) {
    return {
      id,
      severity: 'error',
      detailKind: 'fetchFailed',
      message: t('stateMessage.refreshFailedNamed', { server: label }),
    }
  }
  if (wsStatus === 'disconnected' && fetchOk && lastError === 'e2ee_protocol_mismatch') {
    return {
      id,
      severity: 'error',
      detailKind: 'e2eeProtocolMismatch',
      message: t('stateMessage.e2eeProtocolMismatchNamed', { server: label }),
    }
  }
  if (wsStatus === 'disconnected' && fetchOk) {
    return {
      id,
      severity: 'warning',
      detailKind: 'disconnected',
      message: t('stateMessage.disconnectedNamed', { server: label }),
    }
  }
  if (wsStatus === 'connecting') {
    return {
      id,
      severity: 'info',
      detailKind: 'connecting',
      message: t('stateMessage.connectingNamed', { server: label }),
    }
  }
  return null
}

function toSpec(
  row: ServerRow,
  t: TFunction<'servers'>,
  onRetryFailed: (serverId: string) => void,
  isRetrying: boolean,
): AlertSpec {
  const cause: AlertCause = serverCause(row.id)
  const base = {
    cause,
    level: toLevel(row.severity),
    title: row.message,
    message: getDetailMessage(row.detailKind, t),
    timeout: null as number | null,
  }
  const showAction = row.severity === 'error' || row.severity === 'warning'
  if (!showAction) return base
  if (isRetrying) return { ...base, message: t('stateMessage.retrying') }
  return {
    ...base,
    buttonText: t('action.retry'),
    buttonAction: () => onRetryFailed(row.id),
  }
}

export function ServerStateMessage({
  activeServerIds,
  servers,
  fetchStatuses,
  wsConnectedCount,
  onRetryFailed,
  isRetrying,
}: Props) {
  const { t } = useTranslation('servers')
  const [showInfo, setShowInfo] = useState(false)

  const rows = useMemo((): ServerRow[] => {
    return activeServerIds.flatMap((id) => {
      const row = classifyServer(id, servers, fetchStatuses, t)
      return row ? [row] : []
    })
    // wsConnectedCount triggers recompute when WS state flips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeServerIds, fetchStatuses, wsConnectedCount, servers, t])

  const hasInfo = rows.some((row) => row.severity === 'info')
  useEffect(() => {
    if (!hasInfo) {
      const clear = setTimeout(() => setShowInfo(false), 0)
      return () => clearTimeout(clear)
    }
    const timer = setTimeout(() => setShowInfo(true), INFO_DELAY_MS)
    return () => clearTimeout(timer)
  }, [hasInfo])

  const entries = useMemo((): AlertInput[] => {
    return rows.flatMap((row) => {
      if (row.severity === 'info' && !showInfo) return []
      return [{
        ...toSpec(row, t, onRetryFailed, isRetrying),
        id: `server-state:${row.id}`,
      }]
    })
  }, [rows, showInfo, t, onRetryFailed, isRetrying])

  useAlertListSync(entries)
  return null
}
