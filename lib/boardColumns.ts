import { waitSinceIso } from '@/components/sessions/shared/formatCoarseElapsed'
import { basename } from '@/components/sessions/shared/pathTail'
import type { MergedItem } from '@/components/sessions/now/mergedItems'
import type { SessionTier } from '@/lib/sessionPresentation'
import type { SortBy, SortOrder } from '@/types/ui'

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

function projectOf(item: MergedItem): string {
  return item.kind === 'session' ? item.item.projectName : (basename(item.item.projectPath) ?? '')
}

function waitStartMs(item: MergedItem): number {
  if (item.kind !== 'session') return Number.POSITIVE_INFINITY
  const ms = Date.parse(waitSinceIso(item.item) ?? '')
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY
}

/** Order `state` keeps Needs you longest wait first and the rest most recent first; the others apply to every column. */
export function bucketBoard<E extends { item: MergedItem; tier: SessionTier | null }>(
  entries: readonly E[],
  order: SortBy = 'state',
  direction: SortOrder = 'desc',
): Record<BoardColumnId, E[]> {
  const board: Record<BoardColumnId, E[]> = { needsYou: [], working: [], observed: [], earlier: [] }
  for (const e of entries) board[boardColumnFor(e.tier)].push(e)
  const sign = direction === 'asc' ? -1 : 1
  const byRecent = (a: E, b: E) => sign * (b.item.ms - a.item.ms)
  const byProject = (a: E, b: E) => projectOf(a.item).localeCompare(projectOf(b.item)) || byRecent(a, b)
  const inColumn = order === 'projectName' ? byProject : byRecent
  const byWait = (a: E, b: E) => sign * (waitStartMs(a.item) - waitStartMs(b.item)) || byRecent(a, b)
  board.needsYou.sort(order === 'state' ? byWait : inColumn)
  board.working.sort(inColumn)
  board.observed.sort(inColumn)
  board.earlier.sort(inColumn)
  return board
}

/** The first column with something in it, so the board never opens on an empty page. */
export function firstNonEmptyColumn(board: Record<BoardColumnId, { length: number }>): BoardColumnId {
  return BOARD_COLUMNS.find((c) => board[c].length > 0) ?? 'needsYou'
}

/** Needs you when anything waits, else where the user left off. */
export function startingColumn(
  board: Record<BoardColumnId, { length: number }>,
  remembered: BoardColumnId | null,
): BoardColumnId {
  if (board.needsYou.length > 0) return 'needsYou'
  return remembered ?? firstNonEmptyColumn(board)
}

/**
 * Turns a layout x into a scroll offset. Direction here comes from i18next, not
 * I18nManager, so native scroll views stay physical; only a web RTL scroller
 * counts from its right edge, with scrollLeft running negative.
 */
export function boardScrollX(
  x: number,
  { content, viewport, rtl, web }: { content: number; viewport: number; rtl: boolean; web: boolean },
): number {
  return rtl && web ? x - (content - viewport) : x
}

/** A sub-agent names its parent by any of the ids a live session carries. */
export function subagentParentKeys(item: MergedItem): string[] {
  if (item.kind === 'conversation') return [item.item.id]
  const s = item.item
  return [s.id, s.conversationId, s.boundConversationId].filter((k): k is string => Boolean(k))
}
