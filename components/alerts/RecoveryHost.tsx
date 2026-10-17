import React from 'react'
import { RecoveryOverlay } from '@/components/ui/RecoveryOverlay'
import { useQueryRecoveryAlerts } from '@/hooks/useQueryRecoveryAlerts'
import { selectIsRecovering, useQueryRecoveryStore } from '@/stores/query-recovery'
import { useServersStore } from '@/stores/servers'

/** Single-server full-screen spinner + multi-server Status pill while RQ retries. */
export function RecoveryHost() {
  useQueryRecoveryAlerts()
  const recovering = useQueryRecoveryStore(selectIsRecovering)
  const serverCount = useServersStore((s) => Object.keys(s.servers).length)
  const showOverlay = recovering && serverCount === 1
  return <RecoveryOverlay visible={showOverlay} />
}
