import type { MergedItem } from '@/components/sessions/now/mergedItems'
import { boardColumnFor, boardScrollX, bucketBoard, firstNonEmptyColumn, startingColumn, subagentParentKeys } from '@/lib/boardColumns'
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

describe('bucketBoard order', () => {
  const at = (id: string, ms: number, projectName: string, tier: SessionTier) => ({
    item: { kind: 'session', ms, item: session({ id, projectName }) } as MergedItem,
    tier,
  })
  const ids = (list: { item: MergedItem }[]) => list.map((e) => e.item.item.id)

  it('reverses a column when Order is ascending', () => {
    const board = bucketBoard([at('old', 1, 'p', 'working'), at('new', 2, 'p', 'working')], 'state', 'asc')
    expect(ids(board.working)).toEqual(['old', 'new'])
  })

  it('sorts by project name inside a column', () => {
    const board = bucketBoard([at('b', 2, 'zeta', 'working'), at('a', 1, 'alpha', 'working')], 'projectName')
    expect(ids(board.working)).toEqual(['a', 'b'])
  })

  it('keeps a row with no wait to measure after the waiting ones', () => {
    const conv = { item: { kind: 'conversation', ms: 9, item: conversation({ id: 'conv' }) } as MergedItem, tier: 'needsYou' as const }
    const waited = { item: { kind: 'session', ms: 1, item: session({ id: 'waited', status: 'waiting_input', statusUpdatedAt: '2026-10-30T08:00:00Z' }) } as MergedItem, tier: 'needsYou' as const }
    expect(ids(bucketBoard([conv, waited]).needsYou)).toEqual(['waited', 'conv'])
  })

  it('drops the longest-wait rule when Order is last activity', () => {
    const waitedLong = { item: { kind: 'session', ms: 1, item: session({ id: 'long', status: 'waiting_input', statusUpdatedAt: '2026-10-30T08:00:00Z' }) } as MergedItem, tier: 'needsYou' as const }
    const waitedShort = { item: { kind: 'session', ms: 2, item: session({ id: 'short', status: 'waiting_input', statusUpdatedAt: '2026-10-30T09:00:00Z' }) } as MergedItem, tier: 'needsYou' as const }
    expect(ids(bucketBoard([waitedLong, waitedShort], 'lastActivity').needsYou)).toEqual(['short', 'long'])
  })
})

describe('startingColumn', () => {
  const empty = { needsYou: [], working: [], observed: [], earlier: [] }

  it('starts on Needs you when anything waits, whatever was remembered', () => {
    expect(startingColumn({ ...empty, needsYou: [1], earlier: [2] }, 'earlier')).toBe('needsYou')
  })

  it('otherwise returns to the remembered column, even an empty one', () => {
    expect(startingColumn({ ...empty, working: [1] }, 'observed')).toBe('observed')
  })

  it('falls back to the first column with something in it on first use', () => {
    expect(startingColumn({ ...empty, working: [1] }, null)).toBe('working')
  })
})

describe('boardScrollX', () => {
  it('uses the layout x as is on native, in either direction', () => {
    expect(boardScrollX(300, { content: 1200, viewport: 800, rtl: false, web: false })).toBe(300)
    expect(boardScrollX(300, { content: 1200, viewport: 800, rtl: true, web: false })).toBe(300)
    expect(boardScrollX(300, { content: 1200, viewport: 800, rtl: false, web: true })).toBe(300)
  })

  it('measures from the right edge on RTL web, where scrollLeft runs negative', () => {
    expect(boardScrollX(300, { content: 1200, viewport: 800, rtl: true, web: true })).toBe(-100)
  })
})
