import { isPresentationLive } from '@/lib/sessionPresentation'
import type { MultiConversation, MultiSession } from '@/types/api'

export type MergedItem =
  | { kind: 'session'; ms: number; item: MultiSession }
  | { kind: 'conversation'; ms: number; item: MultiConversation }

/**
 * /api/sessions and /api/conversations are two views of the same work while a
 * process is live. Drop the conversation row when that live session is already
 * in the list, matching Claude `conversationId` and Codex `boundConversationId`.
 */
export function omitConversationsCoveredByLiveSessions(items: MergedItem[]): MergedItem[] {
  const covered = new Set<string>()
  for (const item of items) {
    if (item.kind !== 'session' || !isPresentationLive(item.item)) continue
    covered.add(item.item.id)
    if (item.item.conversationId) covered.add(item.item.conversationId)
    if (item.item.boundConversationId) covered.add(item.item.boundConversationId)
  }
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
