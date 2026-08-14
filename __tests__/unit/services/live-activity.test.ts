import SessionLiveActivity from '@/widgets/SessionLiveActivity'
import {
  decideActions,
  isTerminal,
  liveActivityKey,
  reconcile,
  resetLiveActivities,
  toLiveState,
  type TrackedActivity,
} from '@/services/live-activity'
import { isLiveActivityEnabled } from '@/services/live-activity-enabled'
import type { Session } from '@/types/api'
import { LAST_OUTPUT_MAX_CHARS, type LiveSessionState } from '@/types/live-activity'

jest.mock('@/services/live-activity-enabled', () => ({
  isLiveActivityEnabled: jest.fn(() => true),
}))

const flagEnabled = jest.mocked(isLiveActivityEnabled)
const start = jest.mocked(SessionLiveActivity.start)

const STARTED_AT = '2026-07-25T10:00:00.000Z'

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1',
    status: 'running',
    ptyAttached: true,
    subStatus: null,
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
    expect(isTerminal(makeSession({ status: 'idle', ptyAttached: false, lifecycle: 'completed' }))).toBe(
      true,
    )
    expect(isTerminal(makeSession({ status: 'idle', ptyAttached: false, lifecycle: 'resumable' }))).toBe(
      true,
    )
    expect(isTerminal(makeSession({ status: 'idle', ptyAttached: false }))).toBe(true)
  })

  it('does not treat completedAt alone as terminal (holds stamp it too)', () => {
    expect(isTerminal(makeSession({ completedAt: '2026-07-25T11:00:00.000Z' }))).toBe(false)
  })

  it('does not treat a live session as terminal', () => {
    expect(isTerminal(makeSession())).toBe(false)
    expect(isTerminal(makeSession({ status: 'waiting_input' }))).toBe(false)
    // idle but still attached is a lull, not an ending
    expect(isTerminal(makeSession({ status: 'idle', ptyAttached: true }))).toBe(false)
    expect(isTerminal(makeSession({ processLiveness: 'unknown' }))).toBe(false)
    expect(isTerminal(makeSession({ lifecycle: 'attached' }))).toBe(false)
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
    expect(
      toLiveState(
        makeSession({ status: 'idle', ptyAttached: false, lifecycle: 'completed' }),
        'srv-1',
      ),
    ).toBeNull()
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

  function tracked(...entries: [string, number, boolean][]): TrackedActivity[] {
    return entries.map(([k, lastUpdatedAt, turnOpen]) => ({ key: k, lastUpdatedAt, turnOpen }))
  }

  it('does nothing for a session’s very first running — no prior turn to open', () => {
    const state = makeState()
    expect(decideActions([], undefined, state, key)).toEqual([])
  })

  it('opens a turn on waiting_input → running while slots are free', () => {
    const state = makeState()
    expect(decideActions([], 'waiting_input', state, key)).toEqual([
      { type: 'start', key, state },
    ])
  })

  it('updates an already-open turn on a same-status re-emit', () => {
    const state = makeState({ lastOutput: 'still going' })
    expect(decideActions(tracked([key, 1, true]), 'running', state, key)).toEqual([
      { type: 'update', key, state },
    ])
  })

  it('does nothing for a same-status re-emit with no turn open', () => {
    const state = makeState({ status: 'waiting_input' })
    expect(decideActions([], 'waiting_input', state, key)).toEqual([])
  })

  it('closes an open turn on running → waiting_input with a finished frame', () => {
    const state = makeState({ status: 'waiting_input' })
    expect(decideActions(tracked([key, 1, true]), 'running', state, key)).toEqual([
      { type: 'end', key, finalState: state },
    ])
  })

  it('does nothing on running → waiting_input if no turn was actually open', () => {
    const state = makeState({ status: 'waiting_input' })
    expect(decideActions([], 'running', state, key)).toEqual([])
  })

  it('ends an open turn with no final frame when the session goes non-renderable', () => {
    expect(decideActions(tracked([key, 1, true]), 'running', null, key)).toEqual([
      { type: 'end', key },
    ])
  })

  it('does nothing for a non-renderable session with no open turn', () => {
    expect(decideActions([], 'running', null, key)).toEqual([])
  })

  it('evicts the least-recently-updated when opening a turn at the cap', () => {
    const state = makeState()
    const actions = decideActions(
      tracked(['a', 30, true], ['b', 10, true], ['c', 20, true]),
      'waiting_input',
      state,
      key,
    )
    expect(actions).toEqual([
      { type: 'end', key: 'b' },
      { type: 'start', key, state },
    ])
  })

  it('frees a slot when a tracked turn closes, letting the next one open', () => {
    const full = tracked(['a', 30, true], ['b', 10, true], ['c', 20, true])
    expect(decideActions(full, 'running', makeState({ status: 'waiting_input' }), 'b')).toEqual([
      { type: 'end', key: 'b', finalState: makeState({ status: 'waiting_input' }) },
    ])
    const state = makeState()
    const afterEviction = full.filter((t) => t.key !== 'b')
    expect(decideActions(afterEviction, 'waiting_input', state, key)).toEqual([
      { type: 'start', key, state },
    ])
  })
})

// The rest of this file tests decideActions in isolation; these two go through
// reconcile because the flag gate lives there, ahead of any decision.
describe('reconcile honours the server feature flag', () => {
  /** Opens a turn the way the streamer does: waiting_input, then running. */
  async function openTurn(): Promise<void> {
    await reconcile('srv-1', makeSession({ status: 'waiting_input' }))
    await reconcile('srv-1', makeSession({ status: 'running' }))
  }

  beforeEach(() => {
    resetLiveActivities()
    start.mockClear()
    flagEnabled.mockReturnValue(true)
  })

  it('starts an activity when the server has the flag on', async () => {
    await openTurn()
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('starts nothing when the server has the flag off', async () => {
    flagEnabled.mockReturnValue(false)
    await openTurn()
    expect(start).not.toHaveBeenCalled()
  })
})
