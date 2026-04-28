import { useEffect, useRef, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { wsManager } from '@/services/ws-client'
import { useSettingsStore } from '@/stores/settings'
import { createApiForServer, NotFoundError } from '@/services/api-client'
import { VirtualTerminal } from '@/services/virtual-terminal'

interface TerminalHistoryResponse {
  output?: string
  lines?: string[]
}

const FIVE_MINUTES = 1000 * 60 * 5
const EMPTY_HISTORY: TerminalHistoryResponse = { output: '' }

export function useTerminalStream(serverId: string, sessionId: string) {
  const maxLines = useSettingsStore((s) => s.terminalMaxLines)
  const [lines, setLines] = useState<string[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const vtRef = useRef(new VirtualTerminal())

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
    const client = wsManager.getClient(serverId)
    if (!client) return

    const unsub = client.on('terminal_output', (msg) => {
      if (msg.type !== 'terminal_output' || msg.sessionId !== sessionId) return

      setIsStreaming(true)
      vtRef.current.feed(msg.data)
      const visible = vtRef.current.getLines()
      setLines(visible.slice(-maxLines))

      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => setIsStreaming(false), 1500)
    })

    let idleTimer: ReturnType<typeof setTimeout>
    return () => {
      unsub()
      clearTimeout(idleTimer)
    }
  }, [serverId, sessionId, maxLines])

  const clear = useCallback(() => {
    vtRef.current.reset()
    setLines([])
  }, [])

  return { lines, isStreaming, isLoadingHistory: historyQuery.isPending, clear }
}
