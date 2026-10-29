import { waitSinceIso } from '@/components/sessions/shared/formatCoarseElapsed'
import { mergedItemMatchesQuery, type MergedItem } from '@/components/sessions/now/mergedItems'
import { ALL_PROVIDERS, ALL_TIERS, applyListFilters, type ActiveWithin } from '@/lib/sessionFilters'
import { deriveSessionPresentation, type SessionTier } from '@/lib/sessionPresentation'
import type { MultiConversation, MultiSession } from '@/types/api'

export type BoardColumnId = 'needsYou' | 'working' | 'observed' | 'earlier'

export const BOARD_COLUMNS: readonly BoardColumnId[] = ['needsYou', 'working', 'observed', 'earlier']

/** A session that cannot resume stays in Earlier and is flagged on its card, not given a column. */
export function boardColumnFor(tier: SessionTier): BoardColumnId {
  switch (tier) {
    case 'needsYou':
      return 'needsYou'
    case 'working':
      return 'working'
    case 'observed':
      return 'observed'
    case 'resumable':
    case 'cantResume':
      return 'earlier'
  }
}

// A server may send a timestamp this build cannot parse; NaN degrades to 0.
export function sessionLastActivityMs(s: MultiSession): number {
  const ms = s.completedAt ? Date.parse(s.completedAt) : Date.parse(s.startedAt) + (s.elapsedMs ?? 0)
  return Number.isFinite(ms) ? ms : 0
}

export type BoardEntry =
  | { kind: 'session'; session: MultiSession; title: string; tier: SessionTier }
  | { kind: 'conversation'; conversation: MultiConversation; title: string }

function entryMs(e: BoardEntry): number {
  return e.kind === 'session' ? sessionLastActivityMs(e.session) : Date.parse(e.conversation.lastActivity) || 0
}

export interface BoardColumnData {
  entries: BoardEntry[]
  /** Before search and the Earlier window, so a header can read visible/total. */
  total: number
}

export interface BoardOptions {
  query?: string
  /** Bounds the Earlier column only: a live session is never hidden for being old. */
  earlierWithin?: ActiveWithin
  now?: number
  /** History conversations; they join Earlier unless a listed session already stands for them. */
  conversations?: readonly { conversation: MultiConversation; title: string }[]
}

function waitStartMs(s: MultiSession): number {
  const ms = Date.parse(waitSinceIso(s) ?? '')
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY
}

export function bucketSessionsForBoard(
  rows: readonly { session: MultiSession; title: string }[],
  { query = '', earlierWithin = 'any', now = Date.now(), conversations = [] }: BoardOptions = {},
): Record<BoardColumnId, BoardColumnData> {
  const board: Record<BoardColumnId, BoardColumnData> = {
    needsYou: { entries: [], total: 0 },
    working: { entries: [], total: 0 },
    observed: { entries: [], total: 0 },
    earlier: { entries: [], total: 0 },
  }
  const q = query.trim().toLowerCase()
  const covered = new Set(rows.flatMap(({ session: s }) => [s.id, s.conversationId, s.boundConversationId]))
  const history = conversations.filter((c) => !covered.has(c.conversation.id))
  const asItem = (session: MultiSession): MergedItem => ({ kind: 'session', ms: sessionLastActivityMs(session), item: session })
  const asConvItem = (c: MultiConversation): MergedItem => ({ kind: 'conversation', ms: Date.parse(c.lastActivity) || 0, item: c })
  const inWindow = new Set(
    applyListFilters(
      [...rows.map((r) => asItem(r.session)), ...history.map((c) => asConvItem(c.conversation))],
      { tiers: ALL_TIERS, providers: ALL_PROVIDERS, activeWithin: earlierWithin },
      now,
    ).map((it) => it.item),
  )

  for (const { session, title } of rows) {
    const tier = deriveSessionPresentation(session).tier
    const column = boardColumnFor(tier)
    board[column].total += 1
    if (column === 'earlier' && !inWindow.has(session)) continue
    if (q && !title.toLowerCase().includes(q) && !mergedItemMatchesQuery(asItem(session), q, false)) continue
    board[column].entries.push({ kind: 'session', session, title, tier })
  }
  for (const { conversation, title } of history) {
    board.earlier.total += 1
    if (!inWindow.has(conversation)) continue
    if (q && !title.toLowerCase().includes(q) && !mergedItemMatchesQuery(asConvItem(conversation), q, false)) continue
    board.earlier.entries.push({ kind: 'conversation', conversation, title })
  }

  const byRecent = (a: BoardEntry, b: BoardEntry) => entryMs(b) - entryMs(a)
  const waitOf = (e: BoardEntry) => (e.kind === 'session' ? waitStartMs(e.session) : Number.POSITIVE_INFINITY)
  // Longest wait first: the card that has been stuck longest is the one to answer.
  board.needsYou.entries.sort((a, b) => waitOf(a) - waitOf(b) || byRecent(a, b))
  board.working.entries.sort(byRecent)
  board.observed.entries.sort(byRecent)
  board.earlier.entries.sort(byRecent)
  return board
}
