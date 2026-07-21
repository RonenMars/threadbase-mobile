import type { QueryClient } from '@tanstack/react-query'
import type { MultiSession, Session } from '@/types/api'

/**
 * Reconcile a `session_update` WS frame into the eager home-screen session list
 * (`['sessions-eager', …]`). If the row is already cached, patch it in place
 * (fast path, no refetch). If it is NOT cached in any eager query yet — e.g. an
 * external session that just became alive — invalidate so the list refetches
 * and the row appears without a manual pull-to-refresh. Invalidation (rather
 * than a blind insert) is used because the eager query key carries a status
 * filter, and a refetch respects it where an inserted row might not.
 */
export function applySessionUpdateToEagerCache(
  queryClient: QueryClient,
  serverId: string,
  session: Session,
): void {
  const entries = queryClient.getQueriesData<MultiSession[]>({ queryKey: ['sessions-eager'] })
  const present = entries.some(
    ([, data]) =>
      Array.isArray(data) && data.some((s) => s.serverId === serverId && s.id === session.id),
  )

  if (present) {
    queryClient.setQueriesData<MultiSession[]>({ queryKey: ['sessions-eager'] }, (old) =>
      Array.isArray(old)
        ? old.map((s) =>
            s.serverId === serverId && s.id === session.id ? { ...s, ...session } : s,
          )
        : old,
    )
    return
  }

  void queryClient.invalidateQueries({ queryKey: ['sessions-eager'] })
}

/**
 * A `conversation_updated` ping means an external conversation's JSONL grew (or
 * its owner changed) with no PTY the streamer owns. Refresh the eager
 * conversations list so the row's message count / last activity update without
 * a manual pull-to-refresh.
 */
export function refreshEagerConversations(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ['conversations-eager'] })
}
