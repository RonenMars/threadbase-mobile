import type { QueryClient } from '@tanstack/react-query'
import type { MultiSession } from '@/types/api'
import { useQuickAccessStore, buildFavoriteId } from '@/stores/quickAccess'

/**
 * Drop a vanished session from every eager hub list so a stale favorite /
 * row cannot keep resurrecting a "Session not found" screen after back-nav.
 */
export function removeSessionFromEagerCache(
  queryClient: QueryClient,
  serverId: string,
  sessionId: string,
): void {
  queryClient.setQueriesData<MultiSession[]>({ queryKey: ['sessions-eager'] }, (old) =>
    Array.isArray(old) ? old.filter((s) => !(s.serverId === serverId && s.id === sessionId)) : old,
  )
  queryClient.removeQueries({ queryKey: ['session', serverId, sessionId] })
}

/**
 * Unpin any favorite that pointed at a session the server no longer has.
 * Matches both canonical `${serverId}::session::${id}` favorites and legacy
 * ids that still carry `sessionId` / split-on-`::` shapes.
 */
export function evictStaleSessionFavorite(serverId: string, sessionId: string): void {
  const canonical = buildFavoriteId(serverId, 'session', sessionId)
  const { favorites, unpinItem } = useQuickAccessStore.getState()
  for (const fav of favorites) {
    if (fav.type !== 'session') continue
    if (fav.serverId !== serverId) continue
    const matchesCanonical = fav.id === canonical
    const matchesLegacyField = fav.sessionId === sessionId
    const matchesSplitId = fav.id.split('::').at(-1) === sessionId
    if (matchesCanonical || matchesLegacyField || matchesSplitId) {
      unpinItem(fav.id)
    }
  }
}

export function evictStaleConversationFavorite(serverId: string, conversationId: string): void {
  const canonical = buildFavoriteId(serverId, 'conversation', conversationId)
  const { favorites, unpinItem } = useQuickAccessStore.getState()
  for (const fav of favorites) {
    if (fav.type !== 'conversation') continue
    if (fav.serverId !== serverId) continue
    if (fav.id === canonical || fav.conversationId === conversationId) {
      unpinItem(fav.id)
    }
  }
}

/**
 * After foreground / WS reconnect: force a fresh session detail pull and, when
 * known, the bound conversation so the screen does not keep rendering a
 * pre-disconnect cache snapshot.
 */
export function rehydrateSessionAfterReconnect(
  queryClient: QueryClient,
  serverId: string,
  sessionId: string,
  conversationId?: string | null,
): void {
  void queryClient.invalidateQueries({ queryKey: ['session', serverId, sessionId] })
  if (conversationId) {
    void queryClient.invalidateQueries({ queryKey: ['conversation', serverId, conversationId] })
  }
}

/**
 * Drop every cached page of a conversation transcript (tail and anchored
 * windows share the `['conversation', serverId, id]` prefix) and refetch the
 * mounted ones from scratch, so nothing survives from a stale or partial cache.
 */
export function hardReloadConversation(
  queryClient: QueryClient,
  serverId: string,
  conversationId: string,
): Promise<void> {
  return queryClient.resetQueries({ queryKey: ['conversation', serverId, conversationId] })
}

/**
 * Hard reload for a live session: re-pull the session record, rebuild the
 * bound conversation history, and discard the buffered terminal output.
 * Reconnecting the socket afterwards makes the streamer unicast a fresh
 * terminal_replay for the subscribed session.
 */
export async function hardReloadSession(
  queryClient: QueryClient,
  serverId: string,
  sessionId: string,
  conversationId: string | null | undefined,
  reconnect: () => void,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['session', serverId, sessionId] }),
    queryClient.resetQueries({ queryKey: ['terminal-output', serverId, sessionId] }),
    conversationId ? hardReloadConversation(queryClient, serverId, conversationId) : undefined,
  ])
  reconnect()
}
