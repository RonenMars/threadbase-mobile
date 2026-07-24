import {
  decideActions,
  isTerminal,
  liveActivityKey,
  toLiveState,
  type TrackedActivity,
} from '@/services/live-activity'
import type { Session } from '@/types/api'
import { LAST_OUTPUT_MAX_CHARS, type LiveSessionState } from '@/types/live-activity'

const STARTED_AT = '2026-07-25T10:00:00.000Z'

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1',
    status: 'running',
    ptyAttached: true,
    projectPath: '/home/dev/threadbase',
    projectName: 'threadbase',
    lastOutput: 'building the thing',
    elapsedMs: 12_000,
    promptCount: 3,
    startedAt: STARTED_AT,
    ...overrides,
  }
}

function makeState(overrides: Partial<LiveSessionState> = {}): LiveSessionState {
  return {
    sessionId: 'sess-1',
    serverId: 'srv-1',
    projectName: 'threadbase',
    status: 'running',
    startedAt: Date.parse(STARTED_AT),
    lastOutput: 'building the thing',
    ...overrides,
  }
}

describe('isTerminal', () => {
  it('treats each end-of-life signal independently', () => {
    expect(isTerminal(makeSession({ processLiveness: 'gone' }))).toBe(true)
    expect(isTerminal(makeSession({ completedAt: '2026-07-25T11:00:00.000Z' }))).toBe(true)
    expect(isTerminal(makeSession({ status: 'idle', ptyAttached: false }))).toBe(true)
  })

  it('does not treat a live session as terminal', () => {
    expect(isTerminal(makeSession())).toBe(false)
    expect(isTerminal(makeSession({ status: 'waiting_input' }))).toBe(false)
    // idle but still attached is a lull, not an ending
    expect(isTerminal(makeSession({ status: 'idle', ptyAttached: true }))).toBe(false)
    expect(isTerminal(makeSession({ processLiveness: 'unknown' }))).toBe(false)
  })
})

describe('toLiveState', () => {
  it('maps running and waiting_input to a live state', () => {
    expect(toLiveState(makeSession(), 'srv-1')).toEqual(makeState())
    expect(toLiveState(makeSession({ status: 'waiting_input' }), 'srv-1')?.status).toBe(
      'waiting_input',
    )
  })

  it('returns null for every terminal signal', () => {
    expect(toLiveState(makeSession({ processLiveness: 'gone' }), 'srv-1')).toBeNull()
    expect(toLiveState(makeSession({ completedAt: STARTED_AT }), 'srv-1')).toBeNull()
    expect(toLiveState(makeSession({ status: 'idle', ptyAttached: false }), 'srv-1')).toBeNull()
  })

  it('returns null for a non-live status that is not terminal', () => {
    expect(toLiveState(makeSession({ status: 'idle', ptyAttached: true }), 'srv-1')).toBeNull()
  })

  it('returns null when startedAt is unparseable', () => {
    expect(toLiveState(makeSession({ startedAt: 'not-a-date' }), 'srv-1')).toBeNull()
  })

  it('strips ANSI escapes and box drawing from the last line', () => {
    const session = makeSession({ lastOutput: '[32m│ ✓ tests passed[0m' })
    expect(toLiveState(session, 'srv-1')?.lastOutput).toBe('✓ tests passed')
  })

  it('truncates on a word boundary within the cap', () => {
    const session = makeSession({ lastOutput: 'word '.repeat(40) })
    const out = toLiveState(session, 'srv-1')!.lastOutput
    expect(out.length).toBeLessThanOrEqual(LAST_OUTPUT_MAX_CHARS + 1)
    expect(out.endsWith('…')).toBe(true)
    expect(out).not.toContain(' …')
  })

  it('hard-clips a single long token rather than collapsing the line', () => {
    const session = makeSession({ lastOutput: 'x'.repeat(200) })
    const out = toLiveState(session, 'srv-1')!.lastOutput
    expect(out).toBe(`${'x'.repeat(LAST_OUTPUT_MAX_CHARS)}…`)
  })
})

describe('decideActions', () => {
  const key = liveActivityKey('srv-1', 'sess-1')

  function tracked(...entries: [string, number][]): TrackedActivity[] {
    return entries.map(([k, lastUpdatedAt]) => ({ key: k, lastUpdatedAt }))
  }

  it('starts an untracked session while slots are free', () => {
    const state = makeState()
    expect(decideActions([], state, key)).toEqual([{ type: 'start', key, state }])
  })

  it('updates a session already on screen', () => {
    const state = makeState()
    expect(decideActions(tracked([key, 1]), state, key)).toEqual([{ type: 'update', key, state }])
  })

  it('ends a tracked session that turned terminal', () => {
    expect(decideActions(tracked([key, 1]), null, key)).toEqual([{ type: 'end', key }])
  })

  it('does nothing for an untracked terminal session', () => {
    expect(decideActions([], null, key)).toEqual([])
  })

  it('evicts the least-recently-updated when at the cap', () => {
    const state = makeState()
    const actions = decideActions(tracked(['a', 30], ['b', 10], ['c', 20]), state, key)
    expect(actions).toEqual([
      { type: 'end', key: 'b' },
      { type: 'start', key, state },
    ])
  })

  it('frees a slot when a tracked session ends, letting the next one start', () => {
    const full = tracked(['a', 30], ['b', 10], ['c', 20])
    expect(decideActions(full, null, 'b')).toEqual([{ type: 'end', key: 'b' }])
    const state = makeState()
    const afterEviction = full.filter((t) => t.key !== 'b')
    expect(decideActions(afterEviction, state, key)).toEqual([{ type: 'start', key, state }])
  })
})
