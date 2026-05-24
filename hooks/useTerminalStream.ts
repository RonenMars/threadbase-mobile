import { useEffect, useRef, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { wsManager } from '@/services/ws-client'
import { useSettingsStore } from '@/stores/settings'
import { createApiForServer, NotFoundError } from '@/services/api-client'
import { VirtualTerminal } from '@/services/virtual-terminal'

export type TerminalLine = string

interface TerminalHistoryResponse {
  output?: string
  lines?: string[]
}

const FIVE_MINUTES = 1000 * 60 * 5
const EMPTY_HISTORY: TerminalHistoryResponse = { output: '' }
const TERMINAL_REPLAY_TIMEOUT_MS = 2000

export function useTerminalStream(serverId: string, sessionId: string, skipLiveStream = false) {
  const maxLines = useSettingsStore((s) => s.terminalMaxLines)
  const [lines, setLines] = useState<TerminalLine[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const vtRef = useRef(new VirtualTerminal())
  // Track whether terminal_replay has been received to avoid firing the HTTP fallback
  const replayReceivedRef = useRef(false)
  // Track whether history has been fed (from replay or HTTP) to avoid double-feeding
  const historyFedRef = useRef(false)

  // HTTP fallback query — disabled by default, enabled only when WS replay times out
  const [httpFallbackEnabled, setHttpFallbackEnabled] = useState(false)

  const historyQuery = useQuery({
    queryKey: ['terminal-output', serverId, sessionId],
    queryFn: async () => {
      const api = createApiForServer(serverId)
      try {
        return await api.get<TerminalHistoryResponse>(`/api/sessions/${sessionId}/output`)
      } catch (err) {
        // Older streamers 404 when the PTY isn't tracked (e.g. orphaned after a
        // restart). Treat as no buffered output rather than surfacing an error.
        if (err instanceof NotFoundError) return EMPTY_HISTORY
        throw err
      }
    },
    enabled: Boolean(serverId && sessionId) && httpFallbackEnabled,
    staleTime: FIVE_MINUTES,
    gcTime: FIVE_MINUTES,
    meta: { persist: false },
  })

  function feedHistory(raw: string) {
    if (historyFedRef.current) return
    historyFedRef.current = true
    vtRef.current.reset()
    setLines([])
    vtRef.current.feed(raw)
    const visible = vtRef.current.getLines()
    setLines(visible.slice(-maxLines))
  }

  // Feed HTTP fallback history whenever it loads (only if replay wasn't received)
  useEffect(() => {
    const data = historyQuery.data
    if (!data) return
    if (replayReceivedRef.current) return
    let raw: string
    if (Array.isArray(data)) {
      raw = (data as unknown as string[]).join('')
    } else if (data.lines) {
      raw = data.lines.join('\n')
    } else if (data.output) {
      raw = data.output
    } else {
      return
    }
    feedHistory(raw)
    // feedHistory is a local closure that only reads refs + maxLines; keying on
    // [historyQuery.data, maxLines] captures all behavioural inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyQuery.data, maxLines])

  useEffect(() => {
    // Reset state when sessionId changes
    vtRef.current.reset()
    replayReceivedRef.current = false
    historyFedRef.current = false
    setLines([])
    setHttpFallbackEnabled(false)
  }, [serverId, sessionId])

  useEffect(() => {
    if (skipLiveStream) return

    let idleTimer: ReturnType<typeof setTimeout>
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null
    let unsubOutput: (() => void) | null = null
    let unsubReplay: (() => void) | null = null

    function sendSubscribeAndWaitForReplay() {
      const client = wsManager.getClient(serverId)
      if (!client) return

      // Send subscribe_session — server will unicast terminal_replay back
      client.send({ type: 'subscribe_session', sessionId })

      // Listen for terminal_replay (unicast from server)
      unsubReplay?.()
      unsubReplay = client.on('terminal_replay', (msg) => {
        if (msg.type !== 'terminal_replay' || msg.sessionId !== sessionId) return
        replayReceivedRef.current = true
        if (fallbackTimer) {
          clearTimeout(fallbackTimer)
          fallbackTimer = null
        }
        feedHistory(msg.lines.join('\n'))
      })

      // Start fallback timer — if no terminal_replay within 2s, fall back to HTTP
      if (fallbackTimer) clearTimeout(fallbackTimer)
      fallbackTimer = setTimeout(() => {
        if (!replayReceivedRef.current) {
          setHttpFallbackEnabled(true)
        }
      }, TERMINAL_REPLAY_TIMEOUT_MS)
    }

    function subscribeOutput() {
      unsubOutput?.()
      const client = wsManager.getClient(serverId)
      if (!client) return
      unsubOutput = client.on('terminal_output', (msg) => {
        if (msg.type !== 'terminal_output' || msg.sessionId !== sessionId) return

        setIsStreaming(true)
        vtRef.current.feed(msg.data)
        setLines(vtRef.current.getLines().slice(-maxLines))

        clearTimeout(idleTimer)
        idleTimer = setTimeout(() => setIsStreaming(false), 1500)
      })
    }

    sendSubscribeAndWaitForReplay()
    subscribeOutput()

    // Re-subscribe on reconnect. This handles two cases:
    //   1. Client didn't exist yet when this effect ran (React runs child
    //      effects before parent, so _layout.tsx's wsManager.connect() may
    //      not have fired yet).
    //   2. wsManager.connect() created a new WSClient after reconnect.
    // In both cases, the first 'connected' event on the new client re-binds
    // the listeners and re-sends subscribe_session.
    const unsubStatus = wsManager.onAnyStatusChange((sid, status) => {
      if (sid !== serverId || status !== 'connected') return
      replayReceivedRef.current = false
      historyFedRef.current = false
      sendSubscribeAndWaitForReplay()
      subscribeOutput()
    })

    return () => {
      unsubOutput?.()
      unsubReplay?.()
      unsubStatus()
      clearTimeout(idleTimer)
      if (fallbackTimer) clearTimeout(fallbackTimer)
    }
    // feedHistory is a local closure that only reads refs + maxLines (already
    // in deps); excluding it avoids re-subscribing on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, sessionId, maxLines, skipLiveStream])

  const clear = useCallback(() => {
    vtRef.current.reset()
    setLines([])
  }, [])

  return { lines, isStreaming, isLoadingHistory: historyQuery.isPending && httpFallbackEnabled, clear }
}
