import { waitSinceIso } from '@/components/sessions/shared/formatCoarseElapsed'
import type { MergedItem } from '@/components/sessions/now/mergedItems'
import type { SessionTier } from '@/lib/sessionPresentation'

export type BoardColumnId = 'needsYou' | 'working' | 'observed' | 'earlier'

export const BOARD_COLUMNS: readonly BoardColumnId[] = ['needsYou', 'working', 'observed', 'earlier']

/** Resumable, can't-resume and tierless history all land in Earlier. */
export function boardColumnFor(tier: SessionTier | null): BoardColumnId {
  switch (tier) {
    case 'needsYou':
      return 'needsYou'
    case 'working':
      return 'working'
    case 'observed':
      return 'observed'
    case 'resumable':
    case 'cantResume':
    case null:
      return 'earlier'
  }
}

function waitStartMs(item: MergedItem): number {
  if (item.kind !== 'session') return Number.POSITIVE_INFINITY
  const ms = Date.parse(waitSinceIso(item.item) ?? '')
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY
}

/** Needs you: longest wait first. Every other column: most recent first. */
export function bucketBoard<E extends { item: MergedItem; tier: SessionTier | null }>(
  entries: readonly E[],
): Record<BoardColumnId, E[]> {
  const board: Record<BoardColumnId, E[]> = { needsYou: [], working: [], observed: [], earlier: [] }
  for (const e of entries) board[boardColumnFor(e.tier)].push(e)
  const byRecent = (a: E, b: E) => b.item.ms - a.item.ms
  board.needsYou.sort((a, b) => waitStartMs(a.item) - waitStartMs(b.item) || byRecent(a, b))
  board.working.sort(byRecent)
  board.observed.sort(byRecent)
  board.earlier.sort(byRecent)
  return board
}

/** The first column with something in it, so the board never opens on an empty page. */
export function firstNonEmptyColumn(board: Record<BoardColumnId, { length: number }>): BoardColumnId {
  return BOARD_COLUMNS.find((c) => board[c].length > 0) ?? 'needsYou'
}

/** A sub-agent names its parent by any of the ids a live session carries. */
export function subagentParentKeys(item: MergedItem): string[] {
  if (item.kind === 'conversation') return [item.item.id]
  const s = item.item
  return [s.id, s.conversationId, s.boundConversationId].filter((k): k is string => Boolean(k))
}
