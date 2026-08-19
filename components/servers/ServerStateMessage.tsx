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

    if (healthy.length === 0 && indexing.length === activeServerIds.length) {
      const indexingLabel = indexing.length === 1 ? serverLabel(indexing[0], servers) : null
      return {
        severity: 'info',
        detailKey: 'indexing',
        message: indexingLabel
          ? `${indexingLabel} is building history…`
          : 'Building session history…',
      }
    }

    if (healthy.length === 0) {
      if (unreachable.length > 0) {
        return {
          severity: 'error',
          detailKey: 'unreachable',
          message: single
            ? `Can't reach ${label}. Check your connection or server address.`
            : "Can't reach any server. Check your connection or server address.",
        }
      }
      if (fetchFailed.length > 0) {
        return {
          severity: 'error',
          detailKey: 'fetchFailed',
          message: single
            ? `Couldn't refresh sessions from ${label}.`
            : "Couldn't refresh sessions from any server.",
        }
      }
      if (disconnected.length > 0) {
        return {
          severity: 'warning',
          detailKey: 'disconnected',
          message: single
            ? `Disconnected from ${label}. Showing cached sessions.`
            : 'Disconnected from all servers. Showing cached sessions.',
        }
      }
      if (connecting.length > 0) {
        return {
          severity: 'info',
          detailKey: 'connecting',
          message: single ? `Connecting to ${label}…` : 'Connecting to servers…',
        }
      }
      return { severity: null, message: '', detailKey: null }
    }

    const bad = [...unreachable, ...fetchFailed, ...disconnected]
    if (indexing.length > 0) {
      const indexingLabel = indexing.length === 1 ? serverLabel(indexing[0], servers) : null
      return {
        severity: 'info',
        detailKey: 'indexing',
        message: indexingLabel
          ? `${indexingLabel} is building history…`
          : 'Building session history…',
      }
    }
    if (unreachable.length > 0) {
      const badLabel = unreachable.length === 1 ? serverLabel(unreachable[0], servers) : null
      return {
        severity: 'warning',
        detailKey: 'unreachable',
        message: badLabel
          ? `${badLabel} is unreachable. Some sessions may be missing.`
          : 'Some servers are unreachable. Some sessions may be missing.',
      }
    }
    if (fetchFailed.length > 0) {
      const badLabel = fetchFailed.length === 1 ? serverLabel(fetchFailed[0], servers) : null
      return {
        severity: 'warning',
        detailKey: 'fetchFailed',
        message: badLabel
          ? `Couldn't refresh sessions from ${badLabel}.`
          : "Couldn't refresh sessions from some servers.",
      }
    }
    if (disconnected.length > 0) {
      const badLabel = bad.length === 1 ? serverLabel(bad[0], servers) : null
      return {
        severity: 'warning',
        detailKey: 'disconnected',
        message: badLabel
          ? `Disconnected from ${badLabel}. Showing cached sessions.`
          : 'Disconnected from some servers. Showing cached sessions.',
      }
    }
    if (connecting.length > 0) {
      const connectingLabel = connecting.length === 1 ? serverLabel(connecting[0], servers) : null
      return {
        severity: 'info',
        detailKey: 'connecting',
        message: connectingLabel ? `Connecting to ${connectingLabel}…` : 'Connecting to servers…',
      }
    }

    return { severity: null, message: '', detailKey: null }
    // wsConnectedCount triggers recompute when WS state flips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeServerIds, fetchStatuses, wsConnectedCount, servers])

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
    const details = t(DETAIL_COPY[detailKey])
    if (showAction) {
      return {
        level: toLevel(severity),
        title: message,
        message: details,
        timeout: null,
        hideCloseButton: false,
        buttonText: t('action.details'),
        buttonAction: onViewDetails,
      }
    }
    return {
      level: toLevel(severity),
      title: message,
      message: details,
      timeout: null,
      hideCloseButton: false,
    }
  }, [visible, severity, detailKey, message, showAction, onViewDetails, t])

  useToastSync(TOAST_ID, spec, VIEWPORT)
  return null
}
