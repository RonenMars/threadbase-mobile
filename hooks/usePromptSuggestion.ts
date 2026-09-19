import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { wsManager } from '@/services/ws-client'
import { useSessionDetail } from '@/hooks/useSession'
import type { Session } from '@/types/api'

/**
 * The session's current ghost prompt suggestion. The session query is the one
 * source of truth: REST seeds it, and `prompt_suggestion` frames are merged
 * into it, so a reconnect refetch and a live frame can never disagree.
 *
 * `suggestion` is what the server holds (used to hide the ghost row in the
 * terminal); `chipSuggestion` is the same minus one the user already sent or
 * pulled into the composer, so the chip does not reappear when they clear it.
 */
export function usePromptSuggestion(serverId: string, sessionId: string) {
  const qc = useQueryClient()
  const { data: session } = useSessionDetail(serverId, sessionId)
  const [dismissed, setDismissed] = useState<string | null>(null)

  useEffect(() => {
    let unsubFrame: (() => void) | null = null

    function subscribe() {
      unsubFrame?.()
      const client = wsManager.getClient(serverId)
      if (!client) return
      unsubFrame = client.on('prompt_suggestion', (msg) => {
        if (msg.type !== 'prompt_suggestion' || msg.sessionId !== sessionId) return
        const text = typeof msg.text === 'string' && msg.text.trim() ? msg.text : null
        if (text === null) setDismissed(null)
        qc.setQueryData<Session>(['session', serverId, sessionId], (prev) =>
          prev ? { ...prev, promptSuggestion: text } : prev,
        )
      })
    }

    subscribe()
    // The client object is replaced on reconnect; re-bind to the new one.
    const unsubStatus = wsManager.onAnyStatusChange((sid, status) => {
      if (sid === serverId && status === 'connected') subscribe()
    })
    return () => {
      unsubFrame?.()
      unsubStatus()
    }
  }, [serverId, sessionId, qc])

  const raw = session?.promptSuggestion
  const suggestion =
    session?.status === 'waiting_input' && typeof raw === 'string' && raw.trim() ? raw : null
  const chipSuggestion = suggestion !== null && suggestion !== dismissed ? suggestion : null
  const dismiss = useCallback(() => setDismissed(suggestion), [suggestion])

  return { suggestion, chipSuggestion, dismiss }
}
