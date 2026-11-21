import React, { useEffect, useState } from 'react'
import { RecoveryOverlay } from '@/components/ui/RecoveryOverlay'
import { useQueryRecoveryAlerts } from '@/hooks/useQueryRecoveryAlerts'
import { describeRecovery } from '@/services/query-client'
import { addSafeBreadcrumb, captureSafeMessage } from '@/services/sentry'
import { selectIsRecovering, useQueryRecoveryStore } from '@/stores/query-recovery'
import { describeRoute } from '@/services/route-label'
import { useServersStore } from '@/stores/servers'
import { serverDisplayName } from '@/components/sessions/shared/serverDisplayName'

/** A query retry that never settles stops showing the pill; the error sheet still reports it. */
export const RECOVERY_OVERLAY_MAX_MS = 15_000

/** Non-blocking pill while a query retries or the open session's socket reconnects. */
export function RecoveryHost() {
  useQueryRecoveryAlerts()
  const recovering = useQueryRecoveryStore(selectIsRecovering)
  const lastRequest = useQueryRecoveryStore((s) => s.lastRequest)
  const wsServerId = useQueryRecoveryStore((s) => s.wsReconnectServerId)
  const servers = useServersStore((s) => s.servers)
  const showOverlay = recovering
  const [expired, setExpired] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const active = showOverlay || wsServerId !== null

  if (!active && dismissed) setDismissed(false)

  useEffect(() => {
    if (!showOverlay) return
    const timer = setTimeout(() => {
      addSafeBreadcrumb('recovery_overlay_expired', describeRecovery())
      captureSafeMessage('recovery_overlay_expired')
      setExpired(true)
    }, RECOVERY_OVERLAY_MAX_MS)
    return () => {
      clearTimeout(timer)
      setExpired(false)
    }
  }, [showOverlay])

  const queryVisible = showOverlay && !expired
  const detailServerId = queryVisible && lastRequest ? lastRequest.serverId : wsServerId
  const serverName = detailServerId ? serverDisplayName(servers[detailServerId]) : undefined
  const detail =
    queryVisible && lastRequest
      ? `${serverName} · ${describeRoute(lastRequest.method, lastRequest.path)}`
      : serverName

  return (
    <RecoveryOverlay
      visible={(queryVisible || wsServerId !== null) && !dismissed}
      detail={detail}
      onDismiss={() => setDismissed(true)}
    />
  )
}
