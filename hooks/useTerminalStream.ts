import { useEffect, useRef, useState, useCallback } from 'react'
import { wsClient } from '@/services/ws-client'
import { useSettingsStore } from '@/stores/settings'
import { api } from '@/services/api-client'

interface TerminalHistoryResponse {
  output?: string
  lines?: string[]
}

export function useTerminalStream(sessionId: string) {
  const maxLines = useSettingsStore((s) => s.terminalMaxLines)
  const [lines, setLines] = useState<string[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const bufferRef = useRef<string[]>([])

  // Fetch historical terminal output when the session is opened
  useEffect(() => {
    setIsLoadingHistory(true)
    api.get<TerminalHistoryResponse>(`/api/sessions/${sessionId}/output`)
      .then((data) => {
        let initialLines: string[]
        if (Array.isArray(data)) {
          initialLines = data as unknown as string[]
        } else if (data.lines) {
          initialLines = data.lines
        } else if (data.output) {
          initialLines = data.output.split('\n').map((line: string) => {
            const trimmed = line.endsWith('\r') ? line.slice(0, -1) : line
            const parts = trimmed.split('\r')
            return parts[parts.length - 1]
          })
        } else {
          return
        }
        bufferRef.current = initialLines.slice(-maxLines)
        setLines([...bufferRef.current])
      })
      .catch(() => {
        // Endpoint may not exist or be empty — silently ignore
      })
      .finally(() => {
        setIsLoadingHistory(false)
      })
  }, [sessionId, maxLines])

  useEffect(() => {
    const unsub = wsClient.on('terminal_output', (msg) => {
      if (msg.type !== 'terminal_output' || msg.sessionId !== sessionId) return

      setIsStreaming(true)
      // PTY output uses \r\n. Split on \n first, then handle \r within each
      // line: take the last \r-segment (simulates terminal overwrite / spinner).
      // Trailing \r from \r\n is stripped before the split.
      const newLines = msg.data.split('\n').map((line: string) => {
        const trimmed = line.endsWith('\r') ? line.slice(0, -1) : line
        const parts = trimmed.split('\r')
        return parts[parts.length - 1]
      })

      bufferRef.current = [...bufferRef.current, ...newLines]
      // Ring buffer — trim to maxLines
      if (bufferRef.current.length > maxLines) {
        bufferRef.current = bufferRef.current.slice(bufferRef.current.length - maxLines)
      }
      setLines([...bufferRef.current])

      // Mark as not streaming after a short idle
      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => setIsStreaming(false), 1500)
    })

    let idleTimer: ReturnType<typeof setTimeout>
    return () => {
      unsub()
      clearTimeout(idleTimer)
    }
  }, [sessionId, maxLines])

  const clear = useCallback(() => {
    bufferRef.current = []
    setLines([])
  }, [])

  return { lines, isStreaming, isLoadingHistory, clear }
}
