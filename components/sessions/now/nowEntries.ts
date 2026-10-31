import {
  resolveConversationRowTitle,
  resolveSessionRowTitle,
  type RowTitle,
  storedNameFor,
} from '@/components/sessions/shared/rowTitle'
import {
  deriveConversationPresentation,
  deriveSessionPresentation,
  type SessionStatusLabel,
  type SessionTier,
} from '@/lib/sessionPresentation'
import type { NameOrigin } from '@/stores/sessionNames'
import { mergedItemMatchesQuery, omitConversationsCoveredByLiveSessions, type MergedItem } from './mergedItems'

export interface NowEntry {
  item: MergedItem
  title: RowTitle
  tier: SessionTier | null
  statusLabel: SessionStatusLabel | null
}

/** Search, de-duplication against live sessions, titles and tiers: shared by the Now list and the board. */
export function buildNowEntries(
  items: MergedItem[],
  searchQuery: string,
  conversationsFromServer: boolean,
  names: Record<string, string>,
  nameOrigins: Record<string, NameOrigin>,
): NowEntry[] {
  const q = searchQuery.trim().toLowerCase()
  const visible = q ? items.filter((it) => mergedItemMatchesQuery(it, q, conversationsFromServer)) : items
  return omitConversationsCoveredByLiveSessions(visible).map((item) => {
    const stored = storedNameFor(names, nameOrigins, item.item.serverId, item.item.id)
    if (item.kind === 'session') {
      const presentation = deriveSessionPresentation(item.item)
      return { item, title: resolveSessionRowTitle(item.item, stored), tier: presentation.tier, statusLabel: presentation.statusLabel }
    }
    const presentation = deriveConversationPresentation(item.item)
    return {
      item,
      title: resolveConversationRowTitle(item.item, stored),
      tier: presentation?.tier ?? null,
      statusLabel: presentation?.statusLabel ?? null,
    }
  })
}
