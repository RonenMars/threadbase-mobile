// hooks/useConversationStream.ts
import { useEffect, useRef, useState } from 'react'
import { wsManager } from '@/services/ws-client'
import type { Message, MessageContent } from '@/types/api'

function extractCodexText(content: unknown): string {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''
  return content
    .map((item) => {
      if (typeof item === 'string') return item
      const block = item as { type?: string; text?: string }
      const t = block?.type
      if ((t === 'input_text' || t === 'output_text' || t === 'text') && typeof block.text === 'string') {
        return block.text
      }
      return ''
    })
    .filter(Boolean)
    .join('')
    .trim()
}

function isCodexInjectedContext(text: string): boolean {
  if (text.startsWith('# AGENTS.md') || text.includes('<INSTRUCTIONS>')) return true
  if (text.startsWith('<permissions instructions>') || text.includes('Filesystem sandboxing defines')) {
    return true
  }
  return false
}

/** Defense-in-depth: older streamers still emit raw Codex JSONL over WS. */
function parseCodexLineToMessage(entry: Record<string, unknown>, seq?: number | null): Message | null {
  if (entry.type !== 'response_item') return null
  const payload = entry.payload as
    | { type?: string; role?: string; content?: unknown; id?: string }
    | undefined
  if (!payload || payload.type !== 'message') return null
  const role = payload.role
  if (role !== 'user' && role !== 'assistant') return null
  const text = extractCodexText(payload.content)
  if (!text) return null
  if (role === 'user' && isCodexInjectedContext(text)) return null

  const timestamp = typeof entry.timestamp === 'string' ? entry.timestamp : new Date().toISOString()
  const uuid =
    typeof payload.id === 'string' && payload.id.length > 0
      ? payload.id
      : `codex-${role}-${timestamp}-${text.slice(0, 24)}`

  return {
    id: uuid,
    uuid,
    role,
    content: [{ type: 'text', text }],
    timestamp,
    is_sidechain: false,
    parent_uuid: null,
    messageIndex: typeof seq === 'number' ? seq : undefined,
  }
}

function parseLineToMessage(line: string, seq?: number | null): Message | null {
  try {
    const entry = JSON.parse(line) as {
      type: string
      message?: { role: 'user' | 'assistant'; content?: unknown[] | string }
      uuid?: string
      timestamp?: string
      isMeta?: boolean
      isSidechain?: boolean
      parentUuid?: string | null
      payload?: unknown
    }

    // Codex rollout shape (raw) — normalize before the Claude path rejects it.
    if (entry.type === 'response_item' || entry.type === 'event_msg' || entry.type === 'session_meta') {
      return parseCodexLineToMessage(entry as Record<string, unknown>, seq)
    }

    if (entry.isMeta) return null
    if (entry.type !== 'user' && entry.type !== 'assistant') return null
    if (!entry.message?.role) return null

    // Claude Code writes a typed user prompt with `content` as a bare string,
    // not an array of blocks. Normalize it to a single text block (mirrors the
    // streamer's normalizeContent + scanner's extractTextContent) so the user's
    // own message renders instead of throwing on `.flatMap` and being dropped.
    const rawContentValue = entry.message.content ?? []
    if (typeof rawContentValue === 'string') {
      return {
        id: entry.uuid ?? `${entry.timestamp ?? ''}-${entry.type ?? ''}-${entry.message.role}`,
        uuid: entry.uuid ?? null,
        role: entry.message.role,
        content: [{ type: 'text', text: rawContentValue }],
        timestamp: entry.timestamp ?? new Date().toISOString(),
        is_sidechain: entry.isSidechain ?? false,
        parent_uuid: entry.parentUuid ?? null,
      }
    }
    const rawContent: unknown[] = rawContentValue
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
      messageIndex: typeof seq === 'number' ? seq : undefined,
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
  const [liveMessages, setLiveMessages] = useState<Message[]>([])
  const seenIds = useRef(new Set<string>())

  useEffect(() => {
    if (!serverId || !sessionId) return

    seenIds.current.clear()

    // Singular per-line frame. Old/codex servers send only this. Double-parse
    // with the plural frame below is accepted: on modern servers the plural
    // (seq-carrying) copy arrives first and wins the seenIds race, so the
    // singular dedupes away after parsing. Do NOT drop this subscription to
    // avoid the double-parse — it is the old-server/codex fallback; without it
    // a pre-#202 server leaves the overlay completely empty.
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

    // Additive batched frame (streamer #202): carries seqs so live messages get
    // a real message_index. Same sessionId filter as the singular handler.
    const unsubBatch = wsManager.getClient(serverId)?.on('conversation_events', (msg) => {
      const evt = msg as { type: 'conversation_events'; sessionId: string; lines: string[]; seqs?: (number | null)[] }
      if (evt.sessionId !== sessionId) return
      const next: Message[] = []
      for (let i = 0; i < evt.lines.length; i++) {
        const message = parseLineToMessage(evt.lines[i], evt.seqs?.[i] ?? null)
        if (!message) continue
        if (seenIds.current.has(message.id)) continue
        seenIds.current.add(message.id)
        next.push(message)
      }
      if (next.length > 0) setLiveMessages((prev) => [...prev, ...next])
    })

    const seenIdsRef = seenIds.current
    return () => {
      unsub?.()
      unsubBatch?.()
      setLiveMessages([])
      seenIdsRef.clear()
    }
  }, [serverId, sessionId, conversationId])

  return { liveMessages }
}
