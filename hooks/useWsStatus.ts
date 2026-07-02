import { useEffect, useState } from 'react'
import { wsManager } from '@/services/ws-client'

export type WsStatus = 'connecting' | 'connected' | 'disconnected'

/** Live WS connection status for one server, driven by wsManager status events. */
export function useWsStatus(serverId: string): WsStatus {
  const [status, setStatus] = useState<WsStatus>(() => wsManager.status(serverId))

  useEffect(() => {
    // Re-seed on server change; deferred so the effect body stays render-safe.
    queueMicrotask(() => setStatus(wsManager.status(serverId)))
    return wsManager.onAnyStatusChange((sid, s) => {
      if (sid === serverId) setStatus(s)
    })
  }, [serverId])

  return status
}
