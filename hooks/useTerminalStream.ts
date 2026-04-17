import { useEffect, useRef, useState, useCallback } from 'react'
import { wsManager } from '@/services/ws-client'
import { useSettingsStore } from '@/stores/settings'
import { createApiForServer } from '@/services/api-client'
import { VirtualTerminal } from '@/services/virtual-terminal'

interface TerminalHistoryResponse {
  output?: string
  lines?: string[]
}

export function useTerminalStream(serverId: string, sessionId: string) {
  const maxLines = useSettingsStore((s) => s.terminalMaxLines)
  const [lines, setLines] = useState<string[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const vtRef = useRef(new VirtualTerminal())

  // Fetch historical terminal output when the session is opened
  useEffect(() => {
    vtRef.current.reset()
    setIsLoadingHistory(true)
    const api = createApiForServer(serverId)
    api.get<TerminalHistoryResponse>(`/api/sessions/${sessionId}/output`)
      .then((data) => {
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
      })
      .catch((err) => {
        console.warn('[TerminalStream] history fetch failed:', err)
      })
      .finally(() => {
        setIsLoadingHistory(false)
      })
  }, [serverId, sessionId, maxLines])

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

  return { lines, isStreaming, isLoadingHistory, clear }
}
