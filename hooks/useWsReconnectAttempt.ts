import { useEffect, useState } from 'react'
import { wsManager } from '@/services/ws-client'

/** Live reconnect-attempt counter for one server (0 until the first reconnect is scheduled). */
export function useWsReconnectAttempt(serverId: string): number {
  const [attempt, setAttempt] = useState(() => wsManager.reconnectAttempt(serverId))

  useEffect(() => {
    queueMicrotask(() => setAttempt(wsManager.reconnectAttempt(serverId)))
    return wsManager.onAnyReconnectAttempt((sid, next) => {
      if (sid === serverId) setAttempt(next)
    })
  }, [serverId])

  return attempt
}
