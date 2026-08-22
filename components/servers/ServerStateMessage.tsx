import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
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
}

function serverLabel(id: string, servers: Record<string, ServerConfig>): string {
  const cfg = servers[id]
  if (cfg?.label) return cfg.label
  try { return new URL(cfg?.url ?? '').hostname } catch { return id }
}

type Severity = 'error' | 'warning' | 'info' | null

const DETAIL_COPY = {
  unreachable: 'state.details.unreachable',
  fetchFailed: 'state.details.fetchFailed',
  disconnected: 'state.details.disconnected',
  connecting: 'state.details.connecting',
  indexing: 'state.details.indexing',
} as const
type DetailKey = keyof typeof DETAIL_COPY

const VIEWPORT = 'home'
const TOAST_ID = 'server-state'

function toLevel(severity: Exclude<Severity, null>): AlertLevel {
  if (severity === 'error') return 'error'
  if (severity === 'warning') return 'warning'
  return 'info'
}

export function ServerStateMessage({ activeServerIds, servers, fetchStatuses, wsConnectedCount, onViewDetails }: Props) {
  const { t } = useTranslation('servers')
  const [showInfo, setShowInfo] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { severity, message, detailKey } = useMemo((): { severity: Severity; message: string; detailKey: DetailKey | null } => {
    if (activeServerIds.length === 0) return { severity: null, message: '', detailKey: null }

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
        detailKey: 'indexing',
        message: indexingLabel
          ? t('stateMessage.buildingHistoryNamed', { server: indexingLabel })
          : t('stateMessage.buildingHistory'),
      }
    }

    if (healthy.length === 0) {
      if (unreachable.length > 0) {
        return {
          severity: 'error',
          detailKey: 'unreachable',
          message: single
            ? t('stateMessage.unreachableNamed', { server: label })
            : t('stateMessage.unreachableAll'),
        }
      }
      if (fetchFailed.length > 0) {
        return {
          severity: 'error',
          detailKey: 'fetchFailed',
          message: single
            ? t('stateMessage.refreshFailedNamed', { server: label })
            : t('stateMessage.refreshFailedAll'),
        }
      }
      if (disconnected.length > 0) {
        return {
          severity: 'warning',
          detailKey: 'disconnected',
          message: single
            ? t('stateMessage.disconnectedNamed', { server: label })
            : t('stateMessage.disconnectedAll'),
        }
      }
      if (connecting.length > 0) {
        return {
          severity: 'info',
          detailKey: 'connecting',
          message: single
            ? t('stateMessage.connectingNamed', { server: label })
            : t('stateMessage.connectingAll'),
        }
      }
      return { severity: null, message: '', detailKey: null }
    }

    // Some healthy, some degraded
    const bad = [...unreachable, ...fetchFailed, ...disconnected]
    if (indexing.length > 0) {
      const indexingLabel = indexing.length === 1 ? serverLabel(indexing[0], servers) : null
      return {
        severity: 'info',
        detailKey: 'indexing',
        message: indexingLabel
          ? t('stateMessage.buildingHistoryNamed', { server: indexingLabel })
          : t('stateMessage.buildingHistory'),
      }
    }
    if (unreachable.length > 0) {
      const badLabel = unreachable.length === 1 ? serverLabel(unreachable[0], servers) : null
      return {
        severity: 'warning',
        detailKey: 'unreachable',
        message: badLabel
          ? t('stateMessage.partialUnreachableNamed', { server: badLabel })
          : t('stateMessage.partialUnreachableSome'),
      }
    }
    if (fetchFailed.length > 0) {
      const badLabel = fetchFailed.length === 1 ? serverLabel(fetchFailed[0], servers) : null
      return {
        severity: 'warning',
        detailKey: 'fetchFailed',
        message: badLabel
          ? t('stateMessage.refreshFailedNamed', { server: badLabel })
          : t('stateMessage.refreshFailedSome'),
      }
    }
    if (disconnected.length > 0) {
      const badLabel = bad.length === 1 ? serverLabel(bad[0], servers) : null
      return {
        severity: 'warning',
        detailKey: 'disconnected',
        message: badLabel
          ? t('stateMessage.disconnectedNamed', { server: badLabel })
          : t('stateMessage.disconnectedSome'),
      }
    }
    if (connecting.length > 0) {
      const connectingLabel = connecting.length === 1 ? serverLabel(connecting[0], servers) : null
      return {
        severity: 'info',
        detailKey: 'connecting',
        message: connectingLabel
          ? t('stateMessage.connectingNamed', { server: connectingLabel })
          : t('stateMessage.connectingAll'),
      }
    }

    return { severity: null, message: '', detailKey: null }
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
    if (!visible || !severity || !detailKey) return null
    const base = {
      level: toLevel(severity),
      title: message,
      message: t(DETAIL_COPY[detailKey]),
      timeout: null,
    }
    if (!showAction) return base
    return { ...base, buttonText: t('action.details'), buttonAction: onViewDetails }
  }, [visible, severity, detailKey, message, showAction, onViewDetails, t])

  useToastSync(TOAST_ID, spec, VIEWPORT)
  return null
}
