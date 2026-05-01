import { useEffect, useRef, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { wsManager } from '@/services/ws-client'
import { useSettingsStore } from '@/stores/settings'
import { createApiForServer, NotFoundError } from '@/services/api-client'
import { VirtualTerminal } from '@/services/virtual-terminal'

export type TerminalLine =
  | string
  | { __divider: true; text: string }

interface TerminalHistoryResponse {
  output?: string
  lines?: string[]
}

const FIVE_MINUTES = 1000 * 60 * 5
const EMPTY_HISTORY: TerminalHistoryResponse = { output: '' }

export function useTerminalStream(serverId: string, sessionId: string, skipLiveStream = false) {
  const maxLines = useSettingsStore((s) => s.terminalMaxLines)
  const [lines, setLines] = useState<TerminalLine[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const vtRef = useRef(new VirtualTerminal())
  const pendingDividersRef = useRef<string[]>([])

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
    enabled: Boolean(serverId && sessionId),
    staleTime: FIVE_MINUTES,
    gcTime: FIVE_MINUTES,
    meta: { persist: false },
  })

  // Feed history into the VT whenever it (re)loads or maxLines changes.
  useEffect(() => {
    vtRef.current.reset()
    pendingDividersRef.current = []
    setLines([])
    const data = historyQuery.data
    if (!data) return
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
    vtRef.current.feed(raw)
    const visible = vtRef.current.getLines()
    setLines(visible.slice(-maxLines))
  }, [historyQuery.data, maxLines])

  useEffect(() => {
    // Skip WS subscription for sessions with no live PTY attached — they won't
    // ever send terminal_output events, so subscribing would cause an indefinite hang.
    if (skipLiveStream) return

    let idleTimer: ReturnType<typeof setTimeout>
    let unsubOutput: (() => void) | null = null

    function subscribeOutput() {
      unsubOutput?.()
      const client = wsManager.getClient(serverId)
      if (!client) return
      unsubOutput = client.on('terminal_output', (msg) => {
        if (msg.type !== 'terminal_output' || msg.sessionId !== sessionId) return

        setIsStreaming(true)
        vtRef.current.feed(msg.data)
        setLines((prev) => {
          const existingDividers = prev.filter(
            (l): l is { __divider: true; text: string } =>
              typeof l !== 'string' && (l as { __divider: boolean }).__divider
          )
          const newDividers: TerminalLine[] = pendingDividersRef.current.map(
            (text) => ({ __divider: true as const, text })
          )
          pendingDividersRef.current = []
          const vtLines = vtRef.current.getLines()
          return [...existingDividers, ...newDividers, ...vtLines].slice(-maxLines)
        })

        clearTimeout(idleTimer)
        idleTimer = setTimeout(() => {
          // Flush any pending dividers before marking idle
          if (pendingDividersRef.current.length > 0) {
            const dividers: TerminalLine[] = pendingDividersRef.current.map(
              (text) => ({ __divider: true as const, text })
            )
            pendingDividersRef.current = []
            setLines((prev) => [...prev, ...dividers])
          }
          setIsStreaming(false)
        }, 1500)
      })
    }

    subscribeOutput()

    // Re-subscribe on any status change across all clients for this server.
    // This handles two cases:
    //   1. Client didn't exist yet when this effect ran (React runs child
    //      effects before parent, so _layout.tsx's wsManager.connect() may
    //      not have fired yet).
    //   2. wsManager.connect() created a new WSClient after reconnect.
    // In both cases, the first 'connected' event on the new client re-binds
    // the terminal_output listener.
    const unsubStatus = wsManager.onAnyStatusChange((sid, status) => {
      if (sid !== serverId || status !== 'connected') return
      subscribeOutput()
    })

    return () => {
      unsubOutput?.()
      unsubStatus()
      clearTimeout(idleTimer)
    }
  }, [serverId, sessionId, maxLines, skipLiveStream])

  const clear = useCallback(() => {
    vtRef.current.reset()
    pendingDividersRef.current = []
    setLines([])
  }, [])

  const recordSentInput = useCallback((text: string) => {
    pendingDividersRef.current.push(text)
  }, [])

  return { lines, isStreaming, isLoadingHistory: historyQuery.isPending, clear, recordSentInput }
}
