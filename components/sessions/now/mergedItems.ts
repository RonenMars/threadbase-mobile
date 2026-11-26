import type { MultiConversation, MultiSession } from '@/types/api'

export type MergedItem =
  | { kind: 'session'; ms: number; item: MultiSession }
  | { kind: 'conversation'; ms: number; item: MultiConversation }

function sessionConversationIds(session: MultiSession): string[] {
  return [session.id, session.conversationId, session.boundConversationId].filter((id): id is string => Boolean(id))
}

/**
 * /api/sessions and /api/conversations are two views of the same work while a
 * process is live, and a held (resumable) session is still the same work as its
 * transcript. Drop the conversation row when a session for it is already in the
 * list, matching Claude `conversationId` and Codex `boundConversationId`.
 */
export function omitConversationsCoveredByLiveSessions(items: MergedItem[]): MergedItem[] {
  const covered = new Set(items.flatMap((item) => (item.kind === 'session' ? sessionConversationIds(item.item) : [])))
  if (covered.size === 0) return items
  return items.filter((item) => item.kind !== 'conversation' || !covered.has(item.item.id))
}

// Sessions always match client-side — /api/search does not cover them.
// Conversations only do when they came from the paged set: server results are
// already matched on message bodies, so re-checking title/preview here could
// only drop rows the server correctly found.
export function mergedItemMatchesQuery(
  item: MergedItem,
  q: string,
  conversationsFromServer: boolean,
): boolean {
  if (item.kind === 'session') {
    return Boolean(
      item.item.projectName?.toLowerCase().includes(q) || item.item.lastOutput?.toLowerCase().includes(q),
    )
  }
  if (conversationsFromServer) return true
  return Boolean(item.item.title?.toLowerCase().includes(q) || item.item.preview?.toLowerCase().includes(q))
}

/**
 * The rows a search keeps; run it before omitting covered transcripts. The server
 * matches message bodies, which a session's own text rarely holds, so a live
 * session standing in for a matched conversation has to stay.
 */
export function searchMergedItems(items: MergedItem[], q: string, conversationsFromServer: boolean): MergedItem[] {
  const matches = (item: MergedItem) => mergedItemMatchesQuery(item, q, conversationsFromServer)
  const matchedConversations = new Set(
    items.filter((item) => item.kind === 'conversation' && matches(item)).map((item) => item.item.id),
  )
  return items.filter(
    (item) =>
      matches(item) ||
      (item.kind === 'session' && sessionConversationIds(item.item).some((id) => matchedConversations.has(id))),
  )
}
