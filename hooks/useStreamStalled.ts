import { useEffect, useState } from 'react'
import { wsManager } from '@/services/ws-client'

// Catches the half-dead-socket case: WS reports 'connected' and the session is
// running, yet no terminal frame arrives — well before the 45s silence
// watchdog in useTerminalStream forces a reconnect.
export const STREAM_STALL_TIMEOUT_MS = 15_000

/**
 * True when `enabled` and no `terminal_output` frame for this session has
 * arrived for STREAM_STALL_TIMEOUT_MS. Flips back false on the next frame.
 */
export function useStreamStalled(serverId: string, sessionId: string, enabled: boolean): boolean {
  const [stalled, setStalled] = useState(false)

  useEffect(() => {
    if (!enabled) {
      queueMicrotask(() => setStalled(false))
      return
    }

    let timer = setTimeout(() => setStalled(true), STREAM_STALL_TIMEOUT_MS)
    const client = wsManager.getClient(serverId)
    const unsub = client?.on('terminal_output', (msg) => {
      if (msg.type !== 'terminal_output' || msg.sessionId !== sessionId) return
      setStalled(false)
      clearTimeout(timer)
      timer = setTimeout(() => setStalled(true), STREAM_STALL_TIMEOUT_MS)
    })

    return () => {
      clearTimeout(timer)
      unsub?.()
    }
  }, [serverId, sessionId, enabled])

  return stalled
}
