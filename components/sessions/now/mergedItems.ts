import type { MultiConversation, MultiSession } from '@/types/api'

export type MergedItem =
  | { kind: 'session'; ms: number; item: MultiSession }
  | { kind: 'conversation'; ms: number; item: MultiConversation }

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
