import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useConversation } from '@/hooks/useConversations'
import { useConversationStream } from '@/hooks/useConversationStream'
import { useSessionDetail } from '@/hooks/useSession'
import { mergeLiveMessages, resolveToolNames } from '@/utils/mergeLiveMessages'
import { SESSION_HISTORY_MAX_BYTES } from '@/constants/sessionHistory'
import {
  hasReplyInTranscript,
  resolveTurnFold,
  splitTerminalView,
  TURN_FOLD_SETTLE_MS,
  type SplitTerminalView,
  type TerminalPrompt,
} from '@/lib/splitTerminalView'
import type { Message } from '@/types/api'

interface Options {
  serverId: string
  sessionId: string
  /** Transcript behind this session; `null` means no transcript exists yet. */
  conversationId: string | null
  /** Rendered PTY rows since the last clear. */
  gridLines: string[]
  /** Prompts the streamer submitted, oldest first. */
  prompts: TerminalPrompt[]
  /** A permission or question card is open. */
  cardOpen: boolean
}

/**
 * The terminal view's data: the conversation transcript (REST seed plus the
 * live `conversation_events` stream, merged the way the chat view merges them)
 * split against the PTY grid by `splitTerminalView`.
 *
 * The split needs to know whether a turn is open. `running` says so, but the
 * end of a turn is a decision, not a status: see `resolveTurnFold`. The fold
 * is remembered per prompt (`foldedTs`) so a settled turn stays folded while
 * the status keeps saying `waiting_input`, and a new prompt reopens it by
 * having a newer timestamp.
 */
export function useTerminalTranscript({
  serverId,
  sessionId,
  conversationId,
  gridLines,
  prompts,
  cardOpen,
}: Options) {
  const qc = useQueryClient()
  const history = useConversation(serverId, conversationId ?? '', {
    maxBytes: SESSION_HISTORY_MAX_BYTES,
    enabled: conversationId != null,
  })
  const { liveMessages } = useConversationStream(serverId, conversationId ? sessionId : null, conversationId ?? '')
  const { data: session } = useSessionDetail(serverId, sessionId)

  const messages = useMemo<Message[]>(() => {
    if (!conversationId) return []
    const historical: Message[] = history.data?.messages ?? []
    const ordered = [...historical].sort((a, b) => {
      const ai = a.messageIndex ?? Number.MAX_SAFE_INTEGER
      const bi = b.messageIndex ?? Number.MAX_SAFE_INTEGER
      return ai - bi
    })
    return resolveToolNames(mergeLiveMessages(ordered, liveMessages))
  }, [conversationId, history.data?.messages, liveMessages])

  const latest = prompts.length > 0 ? prompts[prompts.length - 1] : null
  const status = session?.status ?? 'idle'
  const statusSource = session?.statusSource
  const replyLanded = latest != null && hasReplyInTranscript(messages, latest)
  const fold = latest == null
    ? 'fold'
    : resolveTurnFold({ status, statusSource, cardOpen, replyLanded })
  // Only the settled-by-timer fold needs remembering: a fold on a landed reply
  // or a gone PTY stays true on its own (the transcript only grows), so the
  // decision is derived, and a newer prompt reopens it by its timestamp.
  const [settledTs, setSettledTs] = useState<number | null>(null)
  const turnOpen = latest != null && fold !== 'fold' && latest.ts !== settledTs

  // The settle timer for a signalled end whose reply has not reached the
  // transcript yet. Re-armed only while the decision holds: a card opening or
  // the status going back to `running` cancels it, as on the streamer.
  useEffect(() => {
    if (latest == null || fold !== 'fold-after-settle' || latest.ts === settledTs) return
    const ts = latest.ts
    const timer = setTimeout(() => {
      setSettledTs(ts)
      // The reply was not in the transcript when the turn ended — pull the
      // tail so it does not stay missing until the next drain.
      if (conversationId) {
        void qc.invalidateQueries({ queryKey: ['conversation', serverId, conversationId] })
      }
    }, TURN_FOLD_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [fold, latest, settledTs, conversationId, serverId, qc])

  const split = useMemo<SplitTerminalView>(
    () => splitTerminalView({ gridLines, prompts, messages, turnOpen }),
    [gridLines, prompts, messages, turnOpen],
  )

  return {
    ...split,
    turnOpen,
    totalMessages: conversationId ? history.totalMessages : 0,
    hasOlder: Boolean(conversationId && history.hasNextPage),
    isFetchingOlder: Boolean(conversationId && history.isFetchingNextPage),
    fetchOlder: history.fetchNextPage,
  }
}
