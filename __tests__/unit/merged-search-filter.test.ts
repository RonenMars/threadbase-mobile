/**
 * Regression guard for #646: the hub's merged list must not re-filter results
 * that came from /api/search.
 *
 * /api/search matches message bodies; the client only ever sees title and
 * preview, so re-running the predicate on server results can only discard
 * conversations the server correctly matched — exactly the "I know we
 * discussed it, no idea where" case server-side search exists to serve.
 *
 * Sessions keep filtering client-side in both regimes, because /api/search
 * does not cover them.
 */
import { mergedItemMatchesQuery, type MergedItem } from '@/app/index'
import type { MultiConversation, MultiSession } from '@/types/api'

const conversation = (over: Partial<MultiConversation>): MergedItem => ({
  kind: 'conversation',
  ms: 0,
  item: {
    id: 'conv-1',
    title: 'Retry loop refactor',
    projectPath: '/tmp/p',
    messageCount: 12,
    lastActivity: '2026-08-12T10:00:00Z',
    serverId: 'srv-1',
    ...over,
  },
})

const session = (over: Partial<MultiSession>): MergedItem => ({
  kind: 'session',
  ms: 0,
  item: {
    id: 'sess-1',
    status: 'running',
    ptyAttached: true,
    projectPath: '/tmp/p',
    projectName: 'wombat-api',
    lastOutput: 'compiling',
    elapsedMs: 1000,
    promptCount: 2,
    startedAt: '2026-08-12T09:00:00Z',
    serverId: 'srv-1',
    ...over,
  },
})

describe('mergedItemMatchesQuery', () => {
  // The defect: body-only matches have nothing to match on client-side.
  const bodyOnlyMatch = conversation({ title: 'Retry loop refactor', preview: 'Let us ship it' })

  it('keeps a server-matched conversation whose query hits neither title nor preview', () => {
    expect(mergedItemMatchesQuery(bodyOnlyMatch, 'wombat', true)).toBe(true)
  })

  it('still filters conversations on title and preview when they came from the paged set', () => {
    expect(mergedItemMatchesQuery(bodyOnlyMatch, 'wombat', false)).toBe(false)
    expect(mergedItemMatchesQuery(bodyOnlyMatch, 'retry', false)).toBe(true)
    expect(
      mergedItemMatchesQuery(conversation({ preview: 'the wombat timeout' }), 'wombat', false),
    ).toBe(true)
  })

  it('filters session rows client-side even while conversations are server-backed', () => {
    expect(mergedItemMatchesQuery(session({}), 'wombat', true)).toBe(true)
    expect(mergedItemMatchesQuery(session({ projectName: 'billing' }), 'wombat', true)).toBe(false)
    expect(
      mergedItemMatchesQuery(session({ projectName: 'billing', lastOutput: 'wombat timed out' }), 'wombat', true),
    ).toBe(true)
  })
})
