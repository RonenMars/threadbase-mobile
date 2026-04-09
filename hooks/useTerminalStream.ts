import { useEffect, useRef, useState, useCallback } from 'react'
import { wsClient } from '@/services/ws-client'
import { useSettingsStore } from '@/stores/settings'

export function useTerminalStream(sessionId: string) {
  const maxLines = useSettingsStore((s) => s.terminalMaxLines)
  const [lines, setLines] = useState<string[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const bufferRef = useRef<string[]>([])

  useEffect(() => {
    const unsub = wsClient.on('terminal_output', (msg) => {
      if (msg.type !== 'terminal_output' || msg.sessionId !== sessionId) return

      setIsStreaming(true)
      const newLines = msg.data.split('\n')

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

  return { lines, isStreaming, clear }
}
