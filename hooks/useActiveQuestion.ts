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
} from '@/types/api'

type Incoming =
  | QuestionWsMessage
  | QuestionCancelledWsMessage
  | PermissionWsMessage
  | PermissionCancelledWsMessage

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

  const accept = useCallback((key: string | null, block: QuestionBlock) => {
    currentKey.current = key
    dismissedKey.current = null
    setQuestion(block)
  }, [])

  const onMessage = useCallback((msg: Incoming) => {
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
  }, [accept, sessionId])

  const clear = useCallback(() => {
    dismissedKey.current = currentKey.current
    setQuestion(null)
  }, [])

  return { question, onMessage, clear }
}

// Public hook: subscribe to the session WS and feed messages into the reducer.
// Mirrors the subscription pattern in hooks/useConversationStream.ts (same socket source).
export function useActiveQuestion(serverId: string, sessionId: string) {
  const { question, onMessage, clear } = useActiveQuestionReducer(sessionId)

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
    return () => {
      unsubQuestion?.()
      unsubCancelled?.()
      unsubPermission?.()
      unsubPermissionCancelled?.()
    }
  }, [serverId, sessionId, onMessage])

  return { question, onMessage, clear }
}
