import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useToastSync } from '@/hooks/useToastSync'
import { wsManager } from '@/services/ws-client'
import type { ServerFetchStatusEntry } from '@/stores/serverFetchStatus'
import type { AlertLevel, AlertSpec } from '@/types/alerts'
import type { ServerConfig } from '@/types/api'

type Props = {
  activeServerIds: string[]
  servers: Record<string, ServerConfig>
  fetchStatuses: Record<string, ServerFetchStatusEntry>
  wsConnectedCount: number
  onViewDetails: () => void
  onRetryFailed: () => void
  isRetrying: boolean
}

function serverLabel(id: string, servers: Record<string, ServerConfig>): string {
  const cfg = servers[id]
  if (cfg?.label) return cfg.label
  try { return new URL(cfg?.url ?? '').hostname } catch { return id }
}

type Severity = 'error' | 'warning' | 'info' | null

type DetailKind = 'unreachable' | 'fetchFailed' | 'disconnected' | 'connecting' | 'indexing'

function getDetailMessage(detail: DetailKind, t: TFunction<'servers'>): string {
  switch (detail) {
    case 'unreachable':
      return t('state.details.unreachable')
    case 'fetchFailed':
      return t('state.details.fetchFailed')
    case 'disconnected':
      return t('state.details.disconnected')
    case 'connecting':
      return t('state.details.connecting')
    case 'indexing':
      return t('state.details.indexing')
  }
}

const VIEWPORT = 'home'
const TOAST_ID = 'server-state'

function toLevel(severity: Exclude<Severity, null>): AlertLevel {
  if (severity === 'error') return 'error'
  if (severity === 'warning') return 'warning'
  return 'info'
}

export function ServerStateMessage({
  activeServerIds,
  servers,
  fetchStatuses,
  wsConnectedCount,
  onViewDetails,
  onRetryFailed,
  isRetrying,
}: Props) {
  const { t } = useTranslation('servers')
  const [showInfo, setShowInfo] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { severity, message, detailKind } = useMemo((): { severity: Severity; message: string; detailKind: DetailKind | null } => {
    if (activeServerIds.length === 0) return { severity: null, message: '', detailKind: null }

    const healthy: string[] = []
    const unreachable: string[] = []
    const fetchFailed: string[] = []
    const disconnected: string[] = []
    const connecting: string[] = []
    const indexing: string[] = []

    for (const id of activeServerIds) {
      const wsStatus = wsManager.status(id)
      const fetchStatus = fetchStatuses[id]?.status ?? 'ok'
      const fetchOk = fetchStatus === 'ok'
      if (fetchStatus === 'warming_up') indexing.push(id)
      else if (wsStatus === 'connected' && fetchOk) healthy.push(id)
      else if (wsStatus === 'disconnected' && !fetchOk) unreachable.push(id)
      else if (wsStatus === 'connected' && !fetchOk) fetchFailed.push(id)
      else if (wsStatus === 'disconnected' && fetchOk) disconnected.push(id)
      else if (wsStatus === 'connecting') connecting.push(id)
    }

    const single = activeServerIds.length === 1
    const label = single ? serverLabel(activeServerIds[0], servers) : ''

    // All servers unhealthy (indexing servers don't count as unreachable)
    if (healthy.length === 0 && indexing.length === activeServerIds.length) {
      const indexingLabel = indexing.length === 1 ? serverLabel(indexing[0], servers) : null
      return {
        severity: 'info',
        detailKind: 'indexing',
        message: indexingLabel
          ? t('stateMessage.buildingHistoryNamed', { server: indexingLabel })
          : t('stateMessage.buildingHistory'),
      }
    }

    if (healthy.length === 0) {
      if (unreachable.length > 0) {
        return {
          severity: 'error',
          detailKind: 'unreachable',
          message: single
            ? t('stateMessage.unreachableNamed', { server: label })
            : t('stateMessage.unreachableAll'),
        }
      }
      if (fetchFailed.length > 0) {
        return {
          severity: 'error',
          detailKind: 'fetchFailed',
          message: single
            ? t('stateMessage.refreshFailedNamed', { server: label })
            : t('stateMessage.refreshFailedAll'),
        }
      }
      if (disconnected.length > 0) {
        return {
          severity: 'warning',
          detailKind: 'disconnected',
          message: single
            ? t('stateMessage.disconnectedNamed', { server: label })
            : t('stateMessage.disconnectedAll'),
        }
      }
      if (connecting.length > 0) {
        return {
          severity: 'info',
          detailKind: 'connecting',
          message: single
            ? t('stateMessage.connectingNamed', { server: label })
            : t('stateMessage.connectingAll'),
        }
      }
      return { severity: null, message: '', detailKind: null }
    }

    // Some healthy, some degraded
    const bad = [...unreachable, ...fetchFailed, ...disconnected]
    if (indexing.length > 0) {
      const indexingLabel = indexing.length === 1 ? serverLabel(indexing[0], servers) : null
      return {
        severity: 'info',
        detailKind: 'indexing',
        message: indexingLabel
          ? t('stateMessage.buildingHistoryNamed', { server: indexingLabel })
          : t('stateMessage.buildingHistory'),
      }
    }
    if (unreachable.length > 0) {
      const badLabel = unreachable.length === 1 ? serverLabel(unreachable[0], servers) : null
      return {
        severity: 'warning',
        detailKind: 'unreachable',
        message: badLabel
          ? t('stateMessage.partialUnreachableNamed', { server: badLabel })
          : t('stateMessage.partialUnreachableSome'),
      }
    }
    if (fetchFailed.length > 0) {
      const badLabel = fetchFailed.length === 1 ? serverLabel(fetchFailed[0], servers) : null
      return {
        severity: 'warning',
        detailKind: 'fetchFailed',
        message: badLabel
          ? t('stateMessage.refreshFailedNamed', { server: badLabel })
          : t('stateMessage.refreshFailedSome'),
      }
    }
    if (disconnected.length > 0) {
      const badLabel = bad.length === 1 ? serverLabel(bad[0], servers) : null
      return {
        severity: 'warning',
        detailKind: 'disconnected',
        message: badLabel
          ? t('stateMessage.disconnectedNamed', { server: badLabel })
          : t('stateMessage.disconnectedSome'),
      }
    }
    if (connecting.length > 0) {
      const connectingLabel = connecting.length === 1 ? serverLabel(connecting[0], servers) : null
      return {
        severity: 'info',
        detailKind: 'connecting',
        message: connectingLabel
          ? t('stateMessage.connectingNamed', { server: connectingLabel })
          : t('stateMessage.connectingAll'),
      }
    }

    return { severity: null, message: '', detailKind: null }
    // wsConnectedCount triggers recompute when WS state flips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeServerIds, fetchStatuses, wsConnectedCount, servers, t])

  useEffect(() => {
    if (severity === 'info') {
      timerRef.current = setTimeout(() => setShowInfo(true), 2000)
    } else {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setShowInfo(false), 0)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [severity])

  const visible = Boolean(severity) && !(severity === 'info' && !showInfo)
  const showAction = severity === 'error' || severity === 'warning'

  const spec = useMemo((): AlertSpec | null => {
    if (!visible || !severity || !detailKind) return null
    const base = {
      level: toLevel(severity),
      title: message,
      message: getDetailMessage(detailKind, t),
      timeout: null,
    }
    if (!showAction) return base
    if (isRetrying) return { ...base, message: t('stateMessage.retrying'), onPress: onViewDetails }
    return {
      ...base,
      buttonText: t('action.retry'),
      buttonAction: onRetryFailed,
      onPress: onViewDetails,
    }
  }, [visible, severity, detailKind, message, showAction, isRetrying, onRetryFailed, onViewDetails, t])

  useToastSync(TOAST_ID, spec, VIEWPORT)
  return null
}
