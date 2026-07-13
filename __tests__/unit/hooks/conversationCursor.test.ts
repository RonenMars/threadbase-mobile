import type { InfiniteData } from '@tanstack/react-query'
import {
  deriveCursor,
  isEmptyFirstPage,
  stripFirstPage,
  etagOf,
  shouldContinueDrain,
  isCursorValid,
  canTrigger,
  stampTrigger,
  __resetTriggerGuardForTests,
  type ConversationPageParam,
} from '@/hooks/conversationCursor'
import type { RawConversationDetail } from '@/hooks/useConversations'

function page(indexes: number[], pag?: Partial<RawConversationDetail['message_pagination']>): RawConversationDetail {
  return {
    meta: { id: 'c1' },
    messages: indexes.map((i) => ({ message_index: i, role: 'user', timestamp: '', text: `m${i}` })),
    message_pagination: {
      total: indexes.length ? Math.max(...indexes) + 1 : 0,
      before_index: 0,
      from_index: 0,
      has_more_older: false,
      next_before_index: null,
      ...pag,
    },
  } as RawConversationDetail
}

function infinite(pages: RawConversationDetail[], params: ConversationPageParam[]): InfiniteData<RawConversationDetail, ConversationPageParam> {
  return { pages, pageParams: params }
}

describe('deriveCursor', () => {
  it('returns undefined for empty/undefined pages', () => {
    expect(deriveCursor(undefined)).toBeUndefined()
    expect(deriveCursor([])).toBeUndefined()
  })
  it('is stable for the same pages reference and recomputes for a new array (memo)', () => {
    const pages = [page([80, 81, 82]), page([0, 1, 2])]
    expect(deriveCursor(pages)).toBe(82)
    expect(deriveCursor(pages)).toBe(82) // memoized by reference — same result
    // Cache writes always produce a NEW pages array (react-query never mutates
    // in place), so a merge-shaped new array must recompute, not reuse.
    const merged = [page([83, 84]), ...pages]
    expect(deriveCursor(merged)).toBe(84)
  })

  it('returns max message_index across all pages', () => {
    // Pages are newest-chunk-first; page 0 has the highest indexes.
    expect(deriveCursor([page([80, 81, 82]), page([0, 1, 2])])).toBe(82)
  })
})

describe('isEmptyFirstPage / stripFirstPage', () => {
  it('detects an empty first page', () => {
    expect(isEmptyFirstPage(infinite([page([])], [{ resume: 82 }]))).toBe(true)
    expect(isEmptyFirstPage(infinite([page([83])], [{ resume: 82 }]))).toBe(false)
  })
  it('strips pages[0] and pageParams[0]', () => {
    const data = infinite([page([]), page([80])], [{ resume: 82 }, -1])
    const out = stripFirstPage(data)
    expect(out.pages).toHaveLength(1)
    expect(out.pageParams).toEqual([-1])
    expect(data.pages).toHaveLength(2) // original untouched (pure)
  })
})

describe('etagOf', () => {
  it('returns the page etag when present', () => {
    expect(etagOf(page([83], { etag: '"v9"' }))).toBe('"v9"')
  })
  it('returns undefined when absent', () => {
    expect(etagOf(page([83]))).toBeUndefined()
  })
})

describe('shouldContinueDrain', () => {
  it('continues on a non-empty page with has_more_newer', () => {
    expect(shouldContinueDrain(page([83, 84], { has_more_newer: true }))).toBe(true)
  })
  it('stops on has_more_newer false', () => {
    expect(shouldContinueDrain(page([83], { has_more_newer: false }))).toBe(false)
  })
  it('stops on an empty page even if has_more_newer is true', () => {
    expect(shouldContinueDrain(page([], { has_more_newer: true }))).toBe(false)
  })
})

describe('isCursorValid', () => {
  it('valid when total > cursor', () => {
    expect(isCursorValid(page([83], { total: 84 }), 82)).toBe(true)
  })
  it('invalid when total === cursor (0-based boundary)', () => {
    expect(isCursorValid(page([], { total: 82 }), 82)).toBe(false)
  })
  it('invalid when total < cursor (truncation)', () => {
    expect(isCursorValid(page([], { total: 50 }), 82)).toBe(false)
  })
})

describe('trigger guard', () => {
  beforeEach(() => __resetTriggerGuardForTests())
  it('allows the first trigger and blocks a second within the window', () => {
    expect(canTrigger('k', 1000)).toBe(true)
    stampTrigger('k', 1000)
    expect(canTrigger('k', 1000 + 4999)).toBe(false)
    expect(canTrigger('k', 1000 + 5001)).toBe(true)
  })
  it('keys are independent', () => {
    stampTrigger('a', 1000)
    expect(canTrigger('b', 1000)).toBe(true)
  })
})
