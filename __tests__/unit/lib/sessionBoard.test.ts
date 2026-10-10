import { boardColumnFor, bucketSessionsForBoard, type BoardEntry } from '@/lib/sessionBoard'
import type { MultiConversation, MultiSession } from '@/types/api'

const NOW = Date.parse('2026-10-10T12:00:00Z')

const session = (overrides: Partial<MultiSession>): MultiSession => ({
  id: 'sid',
  serverId: 'server-1',
  status: 'idle',
  ptyAttached: false,
  subStatus: null,
  projectPath: '/home/user/tb-mobile',
  projectName: 'tb-mobile',
  lastOutput: '',
  elapsedMs: 0,
  promptCount: 1,
  startedAt: new Date(NOW - 60_000).toISOString(),
  ...overrides,
})

const row = (overrides: Partial<MultiSession>, title = 'a title') => ({ session: session(overrides), title })
const ids = (entries: BoardEntry[]) => entries.map((e) => (e.kind === 'session' ? e.session.id : e.conversation.id))
const conv = (overrides: Partial<MultiConversation>, title = 'a conversation') => ({
  conversation: {
    id: 'cid',
    serverId: 'server-1',
    title: 'tb-mobile',
    projectPath: '/home/user/tb-mobile',
    messageCount: 3,
    lastActivity: new Date(NOW - 120_000).toISOString(),
    ...overrides,
  },
  title,
})

describe('boardColumnFor', () => {
  it('files a session that cannot resume under Earlier rather than its own column', () => {
    expect(boardColumnFor('cantResume')).toBe('earlier')
    expect(boardColumnFor('resumable')).toBe('earlier')
  })
})

describe('bucketSessionsForBoard', () => {
  it('puts each live status in its column', () => {
    const board = bucketSessionsForBoard(
      [
        row({ id: 'wait', status: 'waiting_input', ptyAttached: true }),
        row({ id: 'run', status: 'running', ptyAttached: true }),
        row({ id: 'idle', status: 'idle' }),
      ],
      { now: NOW },
    )
    expect(ids(board.needsYou.entries)).toEqual(['wait'])
    expect(ids(board.working.entries)).toEqual(['run'])
    expect(ids(board.earlier.entries)).toEqual(['idle'])
    expect(board.observed.entries).toEqual([])
  })

  it('keeps a status this build has never heard of on the board', () => {
    const board = bucketSessionsForBoard([row({ id: 'new', status: 'hibernating' as MultiSession['status'] })], { now: NOW })
    expect(ids(board.earlier.entries)).toEqual(['new'])
  })

  it('orders Needs you by longest wait first', () => {
    const board = bucketSessionsForBoard(
      [
        row({ id: 'recent', status: 'waiting_input', ptyAttached: true, statusUpdatedAt: new Date(NOW - 60_000).toISOString() }),
        row({ id: 'stuck', status: 'waiting_input', ptyAttached: true, statusUpdatedAt: new Date(NOW - 3_600_000).toISOString() }),
      ],
      { now: NOW },
    )
    expect(ids(board.needsYou.entries)).toEqual(['stuck', 'recent'])
  })

  it('applies the window to Earlier only and still counts what it hides', () => {
    const old = new Date(NOW - 10 * 86_400_000).toISOString()
    const board = bucketSessionsForBoard(
      [
        row({ id: 'old-idle', startedAt: old }),
        row({ id: 'old-run', status: 'running', ptyAttached: true, startedAt: old }),
      ],
      { earlierWithin: '7d', now: NOW },
    )
    expect(board.earlier.entries).toEqual([])
    expect(board.earlier.total).toBe(1)
    expect(ids(board.working.entries)).toEqual(['old-run'])
  })

  it('searches the title as well as the project', () => {
    const board = bucketSessionsForBoard(
      [row({ id: 'a' }, 'Fix the login bug'), row({ id: 'b', projectName: 'streamer' }, 'Other')],
      { query: 'LOGIN', now: NOW },
    )
    expect(ids(board.earlier.entries)).toEqual(['a'])
    expect(board.earlier.total).toBe(2)
  })

  it('adds history conversations to Earlier, newest first, inside the window', () => {
    const board = bucketSessionsForBoard([row({ id: 'idle' })], {
      now: NOW,
      earlierWithin: '7d',
      conversations: [
        conv({ id: 'recent', lastActivity: new Date(NOW - 30_000).toISOString() }),
        conv({ id: 'old', lastActivity: new Date(NOW - 20 * 86_400_000).toISOString() }),
      ],
    })
    expect(ids(board.earlier.entries)).toEqual(['recent', 'idle'])
    expect(board.earlier.total).toBe(3)
  })

  it('leaves out a conversation a listed session already stands for', () => {
    const board = bucketSessionsForBoard([row({ id: 'run', status: 'running', ptyAttached: true, conversationId: 'c-run' })], {
      now: NOW,
      conversations: [conv({ id: 'c-run' }), conv({ id: 'run' }), conv({ id: 'other' })],
    })
    expect(ids(board.earlier.entries)).toEqual(['other'])
    expect(board.earlier.total).toBe(1)
  })
})
