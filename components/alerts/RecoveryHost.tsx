import React, { useEffect, useState } from 'react'
import { RecoveryOverlay } from '@/components/ui/RecoveryOverlay'
import { useQueryRecoveryAlerts } from '@/hooks/useQueryRecoveryAlerts'
import { selectIsRecovering, useQueryRecoveryStore } from '@/stores/query-recovery'
import { useServersStore } from '@/stores/servers'

/**
 * The overlay takes every tap, so a retry that never settles (an overloaded or
 * unreachable server) would lock Settings out too. Past this the screen is
 * handed back; the Status pill and error sheet still report the problem.
 */
export const RECOVERY_OVERLAY_MAX_MS = 15_000

/** Single-server full-screen spinner + multi-server Status pill while RQ retries. */
export function RecoveryHost() {
  useQueryRecoveryAlerts()
  const recovering = useQueryRecoveryStore(selectIsRecovering)
  const serverCount = useServersStore((s) => Object.keys(s.servers).length)
  const showOverlay = recovering && serverCount === 1
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    if (!showOverlay) return
    const timer = setTimeout(() => setExpired(true), RECOVERY_OVERLAY_MAX_MS)
    return () => {
      clearTimeout(timer)
      setExpired(false)
    }
  }, [showOverlay])

  return <RecoveryOverlay visible={showOverlay && !expired} />
}
