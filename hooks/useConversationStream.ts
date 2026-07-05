// hooks/useConversationStream.ts
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { wsManager } from '@/services/ws-client'
import type { Message, MessageContent } from '@/types/api'

function parseLineToMessage(line: string): Message | null {
  try {
    const entry = JSON.parse(line) as {
      type: string
      message?: { role: 'user' | 'assistant'; content?: unknown[] }
      uuid?: string
      timestamp?: string
      isMeta?: boolean
      isSidechain?: boolean
      parentUuid?: string | null
    }

    if (entry.isMeta) return null
    if (entry.type !== 'user' && entry.type !== 'assistant') return null
    if (!entry.message?.role) return null

    const rawContent: unknown[] = entry.message.content ?? []
    const content: MessageContent[] = rawContent.flatMap((block): MessageContent[] => {
      const b = block as Record<string, unknown>
      if (b.type === 'text' && typeof b.text === 'string') {
        return [{ type: 'text', text: b.text }]
      }
      if (b.type === 'thinking' && typeof b.thinking === 'string') {
        return [{ type: 'thinking', thinking: b.thinking, signature: typeof b.signature === 'string' ? b.signature : undefined }]
      }
      if (b.type === 'tool_use' && typeof b.name === 'string') {
        return [{ type: 'tool_use', name: b.name, input: (b.input as Record<string, unknown>) ?? {} }]
      }
      if (b.type === 'tool_result') {
        const content = typeof b.content === 'string' ? b.content : JSON.stringify(b.content)
        return [{ type: 'tool_result', toolName: '', content, isError: b.is_error === true }]
      }
      return []
    })

    return {
      id: entry.uuid ?? `${entry.timestamp ?? ''}-${entry.type ?? ''}-${entry.message?.role ?? ''}`,
      uuid: entry.uuid ?? null,
      role: entry.message.role,
      content,
      timestamp: entry.timestamp ?? new Date().toISOString(),
      is_sidechain: entry.isSidechain ?? false,
      parent_uuid: entry.parentUuid ?? null,
    }
  } catch {
    return null
  }
}

export function useConversationStream(
  serverId: string,
  sessionId: string | null,
  conversationId: string,
) {
  const qc = useQueryClient()
  const [liveMessages, setLiveMessages] = useState<Message[]>([])
  const seenIds = useRef(new Set<string>())
  const prevSessionStatus = useRef<string | null>(null)

  useEffect(() => {
    if (!serverId || !sessionId) return

    seenIds.current.clear()
    prevSessionStatus.current = null
    // On (re)subscribe, force REST refresh to recover messages missed while WS was down.
    qc.invalidateQueries({ queryKey: ['conversation', serverId, conversationId] })

    const unsub = wsManager.getClient(serverId)?.on('conversation_event', (msg) => {
      // wsManager.on uses a union type; cast is safe once Task 1 adds the type
      const evt = msg as { type: 'conversation_event'; sessionId: string; line: string }
      if (evt.sessionId !== sessionId) return
      const message = parseLineToMessage(evt.line)
      if (!message) return
      if (seenIds.current.has(message.id)) return
      seenIds.current.add(message.id)
      setLiveMessages((prev) => [...prev, message])
    })

    // conversation_events emitted while the WS was dead are never replayed —
    // refetch the REST history whenever the connection comes back so bubbles
    // missed during the outage land (mirrors useTerminalStream's re-subscribe).
    const unsubStatus = wsManager.onAnyStatusChange((sid, status) => {
      if (sid !== serverId || status !== 'connected') return
      qc.invalidateQueries({ queryKey: ['conversation', serverId, conversationId] })
    })

    // Safety net for a dead server-side tail pipeline: if conversation_event
    // frames stop arriving, nothing above refetches while the screen stays
    // open. session_update still flips when a turn ends (PTY prompt marker),
    // so a running → not-running transition pulls whatever REST has.
    const unsubSession = wsManager.getClient(serverId)?.on('session_update', (msg) => {
      if (msg.type !== 'session_update' || msg.session.id !== sessionId) return
      const prev = prevSessionStatus.current
      prevSessionStatus.current = msg.session.status
      if (prev === 'running' && msg.session.status !== 'running') {
        qc.invalidateQueries({ queryKey: ['conversation', serverId, conversationId] })
      }
    })

    const seenIdsRef = seenIds.current
    return () => {
      unsub?.()
      unsubStatus()
      unsubSession?.()
      setLiveMessages([])
      seenIdsRef.clear()
    }
  }, [serverId, sessionId, conversationId, qc])

  return { liveMessages }
}
