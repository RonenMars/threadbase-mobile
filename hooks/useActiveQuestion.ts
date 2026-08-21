import { useCallback, useEffect, useRef, useState } from 'react'
import { wsManager } from '@/services/ws-client'
import { mapAskQuestionToBlock } from '@/utils/mapAskQuestionToBlock'
import { mapPermissionToBlock } from '@/utils/mapPermissionToBlock'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'
import type {
  QuestionWsMessage,
  QuestionCancelledWsMessage,
  PermissionWsMessage,
  PermissionCancelledWsMessage,
  Session,
  SessionStatus,
} from '@/types/api'

type SessionUpdateMessage = { type: 'session_update'; session: Session }

type Incoming =
  | QuestionWsMessage
  | QuestionCancelledWsMessage
  | PermissionWsMessage
  | PermissionCancelledWsMessage
  | SessionUpdateMessage

// Content identity of a gate, cursor deliberately excluded. The streamer's own
// dedupe key includes the cursor, so a repaint that only moves it re-broadcasts
// the same gate — which would put a card the user already answered back on
// screen a beat after it went away.
function gateKey(msg: PermissionWsMessage): string {
  const options = msg.options.map(o => `${o.index}.${o.label}`).join(',')
  return `${msg.prompt ?? ''}::${msg.detail ?? ''}::${options}`
}

export function useActiveQuestionReducer(sessionId: string) {
  const [question, setQuestion] = useState<QuestionBlock | null>(null)
  // Identity of whatever `question` currently holds, and of the last thing
  // `clear()` took down. The server closes a gate only when its PTY detector
  // sees the box gone — end of turn, tens of seconds after the tap — so a card
  // cleared on answer has to defend itself against repaints in the meantime.
  // ponytail: dropped on the next cancellation or different gate; an identical
  // gate that reopens with neither in between stays hidden.
  const currentKey = useRef<string | null>(null)
  const dismissedKey = useRef<string | null>(null)
  // Last status this session was seen in. The teardown below is edge-triggered
  // off it: the gate broadcast and the status flip to `waiting_input` are two
  // separate messages with no ordering guarantee, so "status isn't
  // waiting_input" on its own would tear down a card a beat after it arrived.
  // What that costs: the status exit is inert until a `waiting_input` update
  // has actually been observed, so it never fires for a card that arrived by
  // subscribe replay into an already-waiting session. `*_cancelled` is the exit
  // that covers that window.
  const lastStatus = useRef<SessionStatus | null>(null)

  const accept = useCallback((key: string | null, block: QuestionBlock) => {
    currentKey.current = key
    dismissedKey.current = null
    setQuestion(block)
  }, [])

  // The card's premise died — the socket dropped, or the session stopped
  // waiting for input — so it comes down without the user having dismissed
  // anything. Deliberately NOT clear(): clear() arms dismissedKey so a repaint
  // of the gate the user just answered stays down, and the gate replayed on
  // resubscribe is byte-identical to the one this took away. Arming it here
  // would swallow that replay and turn a stuck card into a card that can never
  // come back. Leaving dismissedKey untouched keeps both halves right: an
  // unanswered gate returns on replay, an answered one stays suppressed.
  const reset = useCallback(() => {
    currentKey.current = null
    setQuestion(null)
  }, [])

  const onMessage = useCallback((msg: Incoming) => {
    if (msg.type === 'session_update') {
      if (msg.session.id !== sessionId) return
      const left = lastStatus.current === 'waiting_input' && msg.session.status !== 'waiting_input'
      lastStatus.current = msg.session.status
      if (left) reset()
      return
    }
    if (msg.sessionId !== sessionId) return
    if (msg.type === 'question') {
      if (dismissedKey.current === msg.toolUseId) return
      accept(msg.toolUseId, mapAskQuestionToBlock(msg.toolUseId, msg.questions))
    } else if (msg.type === 'question_cancelled') {
      dismissedKey.current = null
      setQuestion(prev => (prev?.toolUseId === msg.toolUseId ? null : prev))
    } else if (msg.type === 'permission') {
      const key = gateKey(msg)
      if (dismissedKey.current === key) return
      accept(key, mapPermissionToBlock(msg.prompt, msg.options, msg.cursor, msg.detail))
    } else if (msg.type === 'permission_cancelled') {
      dismissedKey.current = null
      setQuestion(prev => (prev?.source === 'permission' ? null : prev))
    }
  }, [accept, reset, sessionId])

  const clear = useCallback(() => {
    dismissedKey.current = currentKey.current
    setQuestion(null)
  }, [])

  return { question, onMessage, clear, reset }
}

// Public hook: subscribe to the session WS and feed messages into the reducer.
// Mirrors the subscription pattern in hooks/useConversationStream.ts (same socket source).
export function useActiveQuestion(serverId: string, sessionId: string) {
  const { question, onMessage, clear, reset } = useActiveQuestionReducer(sessionId)

  useEffect(() => {
    if (!serverId || !sessionId) return
    const client = wsManager.getClient(serverId)
    const unsubQuestion = client?.on('question', (msg) => {
      if (msg.type === 'question') onMessage(msg)
    })
    const unsubCancelled = client?.on('question_cancelled', (msg) => {
      if (msg.type === 'question_cancelled') onMessage(msg)
    })
    const unsubPermission = client?.on('permission', (msg) => {
      if (msg.type === 'permission') onMessage(msg)
    })
    const unsubPermissionCancelled = client?.on('permission_cancelled', (msg) => {
      if (msg.type === 'permission_cancelled') onMessage(msg)
    })
    const unsubSessionUpdate = client?.on('session_update', (msg) => {
      if (msg.type === 'session_update') onMessage(msg)
    })
    // onAnyStatusChange, not onStatusChange: a reconnect replaces the WSClient
    // instance, and a listener bound to the old one stops firing.
    const unsubStatus = wsManager.onAnyStatusChange((id, status) => {
      if (id === serverId && status === 'disconnected') reset()
    })
    return () => {
      unsubQuestion?.()
      unsubCancelled?.()
      unsubPermission?.()
      unsubPermissionCancelled?.()
      unsubSessionUpdate?.()
      unsubStatus()
    }
  }, [serverId, sessionId, onMessage, reset])

  return { question, onMessage, clear, reset }
}
