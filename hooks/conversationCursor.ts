import type { InfiniteData } from '@tanstack/react-query'
// MUST be `import type`: Metro/Babel transpiles file-by-file with no cross-file
// type analysis, so a bare `import { RawConversationDetail }` is preserved as a
// runtime value import — reintroducing the useConversations ⇄ conversationCursor
// cycle. `import type` is erased by Babel, keeping the only runtime edge
// one-way (useConversations → conversationCursor).
import type { RawConversationDetail } from '@/hooks/useConversations'

// -1 = tail first page; number = before_index (older); { after } = anchored
// newer cursor; { resume } = tail delta-on-open cursor.
export type ConversationPageParam = number | { after: number } | { resume: number }

type ConvData = InfiniteData<RawConversationDetail, ConversationPageParam>

// Takes the raw pages array (not the InfiniteData wrapper) so it is the single
// source of cursor derivation for BOTH callers: getPreviousPageParam passes its
// `allPages` argument, and the trigger effect passes `query.data.pages`. One
// function, no drift.
// Memoized by pages-array identity: react-query evaluates getPreviousPageParam
// (and therefore this walk over every cached message) on each render via
// hasPreviousPage, and cache writes always replace the pages array, so the
// reference is a correct cache key. WeakMap keeps evicted arrays collectable.
const cursorByPages = new WeakMap<RawConversationDetail[], number | undefined>()

export function deriveCursor(pages: RawConversationDetail[] | undefined): number | undefined {
  if (!pages?.length) return undefined
  if (cursorByPages.has(pages)) return cursorByPages.get(pages)
  let max = -1
  for (const p of pages) {
    for (const m of p.messages ?? []) {
      if (typeof m.message_index === 'number' && m.message_index > max) max = m.message_index
    }
  }
  const cursor = max >= 0 ? max : undefined
  cursorByPages.set(pages, cursor)
  return cursor
}

export function isEmptyFirstPage(data: ConvData | undefined): boolean {
  return (data?.pages?.[0]?.messages?.length ?? -1) === 0
}

export function stripFirstPage(data: ConvData): ConvData {
  return {
    pages: data.pages.slice(1),
    pageParams: data.pageParams.slice(1),
  }
}

// The after_index delta's whole-conversation etag (present only on after_index
// responses). Changes on every append, so it can only detect a file changing
// between two reads — never validate cursor continuity.
export function etagOf(page: RawConversationDetail): string | undefined {
  return page.message_pagination?.etag
}

export function shouldContinueDrain(page: RawConversationDetail): boolean {
  return (page.messages?.length ?? 0) > 0 && page.message_pagination?.has_more_newer === true
}

// message_index is 0-based: index N exists iff total >= N+1. So total <= cursor
// means the server's history is at or behind our cursor — a truncation/rewrite.
export function isCursorValid(page: RawConversationDetail, cursor: number): boolean {
  const total = page.message_pagination?.total
  if (typeof total !== 'number') return true
  return total > cursor
}

const lastTriggeredAt = new Map<string, number>()
const DEFAULT_WINDOW_MS = 5000

export function canTrigger(queryKeyHash: string, now: number, windowMs: number = DEFAULT_WINDOW_MS): boolean {
  const last = lastTriggeredAt.get(queryKeyHash)
  return last === undefined || now - last >= windowMs
}

export function stampTrigger(queryKeyHash: string, now: number): void {
  lastTriggeredAt.set(queryKeyHash, now)
}

export function __resetTriggerGuardForTests(): void {
  lastTriggeredAt.clear()
}
