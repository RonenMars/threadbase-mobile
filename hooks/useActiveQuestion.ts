import { useCallback, useEffect, useState } from 'react'
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

export function useActiveQuestionReducer(sessionId: string) {
  const [question, setQuestion] = useState<QuestionBlock | null>(null)
  const onMessage = useCallback((msg: Incoming) => {
    if (msg.sessionId !== sessionId) return
    if (msg.type === 'question') {
      setQuestion(mapAskQuestionToBlock(msg.toolUseId, msg.questions))
    } else if (msg.type === 'question_cancelled') {
      setQuestion(prev => (prev?.toolUseId === msg.toolUseId ? null : prev))
    } else if (msg.type === 'permission') {
      setQuestion(mapPermissionToBlock(msg.prompt, msg.options, msg.cursor, msg.detail))
    } else if (msg.type === 'permission_cancelled') {
      setQuestion(prev => (prev?.source === 'permission' ? null : prev))
    }
  }, [sessionId])
  const clear = useCallback(() => setQuestion(null), [])
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
