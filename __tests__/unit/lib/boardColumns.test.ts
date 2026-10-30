import type { MergedItem } from '@/components/sessions/now/mergedItems'
import { boardColumnFor, bucketBoard, firstNonEmptyColumn, subagentParentKeys } from '@/lib/boardColumns'
import type { SessionTier } from '@/lib/sessionPresentation'
import type { MultiConversation, MultiSession } from '@/types/api'

const session = (overrides: Partial<MultiSession>): MultiSession => ({
  id: 'sid',
  serverId: 'server-1',
  status: 'idle',
  ptyAttached: false,
  subStatus: null,
  projectPath: '/p',
  projectName: 'p',
  branch: 'main',
  lastOutput: '',
  elapsedMs: 0,
  promptCount: 1,
  startedAt: '2026-10-30T10:00:00Z',
  ...overrides,
})

const conversation = (overrides: Partial<MultiConversation>): MultiConversation => ({
  id: 'cid',
  serverId: 'server-1',
  title: 't',
  projectPath: '/p',
  messageCount: 1,
  lastActivity: '2026-10-30T10:00:00Z',
  ...overrides,
})

const entry = (id: string, tier: SessionTier | null, ms: number, extra: Partial<MultiSession> = {}) => ({
  item: { kind: 'session', ms, item: session({ id, ...extra }) } satisfies MergedItem,
  tier,
})

describe('boardColumnFor', () => {
  it.each([
    ['needsYou', 'needsYou'],
    ['working', 'working'],
    ['observed', 'observed'],
    ['resumable', 'earlier'],
    ['cantResume', 'earlier'],
    [null, 'earlier'],
  ] as const)('%s goes to %s', (tier, column) => {
    expect(boardColumnFor(tier)).toBe(column)
  })
})

describe('bucketBoard', () => {
  it('sorts Needs you by longest wait, the rest by recency', () => {
    const board = bucketBoard([
      entry('short-wait', 'needsYou', 900, { statusUpdatedAt: '2026-10-30T10:50:00Z' }),
      entry('long-wait', 'needsYou', 100, { statusUpdatedAt: '2026-10-30T10:00:00Z' }),
      entry('no-wait-stamp', 'needsYou', 999),
      entry('old', 'working', 100),
      entry('new', 'working', 500),
      entry('hist-old', 'resumable', 1),
      entry('hist-new', null, 2),
    ])
    expect(board.needsYou.map((e) => e.item.item.id)).toEqual(['long-wait', 'short-wait', 'no-wait-stamp'])
    expect(board.working.map((e) => e.item.item.id)).toEqual(['new', 'old'])
    expect(board.observed).toEqual([])
    expect(board.earlier.map((e) => e.item.item.id)).toEqual(['hist-new', 'hist-old'])
  })
})

describe('firstNonEmptyColumn', () => {
  it('skips empty columns and falls back to Needs you', () => {
    expect(firstNonEmptyColumn({ needsYou: [], working: [], observed: [1], earlier: [2] })).toBe('observed')
    expect(firstNonEmptyColumn({ needsYou: [], working: [], observed: [], earlier: [] })).toBe('needsYou')
  })
})

describe('subagentParentKeys', () => {
  it('lists every id a live session can be named by', () => {
    const item: MergedItem = { kind: 'session', ms: 0, item: session({ id: 's', conversationId: 'c', boundConversationId: null }) }
    expect(subagentParentKeys(item)).toEqual(['s', 'c'])
  })

  it('uses the conversation id for history', () => {
    expect(subagentParentKeys({ kind: 'conversation', ms: 0, item: conversation({ id: 'h' }) })).toEqual(['h'])
  })
})
