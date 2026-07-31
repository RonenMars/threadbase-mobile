import {
  adoptRunningActivities,
  reconcile,
  resetLiveActivities,
} from '@/services/live-activity'
import type { Session } from '@/types/api'
import SessionLiveActivity from '@/widgets/SessionLiveActivity'

// jest.setup.js replaces this module with plain jest.fn()s; the cast reaches
// the mock's assertion surface, which the real LiveActivityFactory type hides.
const factory = jest.mocked(SessionLiveActivity)

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1',
    status: 'running',
    ptyAttached: true,
    projectPath: '/home/dev/threadbase',
    projectName: 'threadbase',
    lastOutput: 'compiling',
    elapsedMs: 1_000,
    promptCount: 1,
    startedAt: '2026-07-25T10:00:00.000Z',
    ...overrides,
  }
}

/**
 * A surface only opens on a `waiting_input → running` edge, so every case that
 * needs one on screen has to drive that edge — a bare `running` opens nothing.
 */
async function openTurn(serverId: string, running: Session): Promise<void> {
  await reconcile(serverId, { ...running, status: 'waiting_input' })
  await reconcile(serverId, running)
}

describe('live activity reconciler', () => {
  beforeEach(() => {
    resetLiveActivities()
    factory.start.mockClear()
  })

  it('opens nothing for a session’s first running — no turn has been asked for', async () => {
    await reconcile('srv-1', session())
    expect(factory.start).not.toHaveBeenCalled()
  })

  it('starts an activity deep-linked to the session on its server', async () => {
    await openTurn('srv-1', session())
    expect(factory.start).toHaveBeenCalledTimes(1)
    const [state, url] = factory.start.mock.calls[0]
    expect(state).toMatchObject({ sessionId: 'sess-1', serverId: 'srv-1', status: 'running' })
    expect(url).toBe('threadbase://session/sess-1?server=srv-1')
  })

  it('updates rather than restarts a session it already tracks', async () => {
    await openTurn('srv-1', session())
    const handle = factory.start.mock.results[0].value
    await reconcile('srv-1', session({ lastOutput: 'still going' }))
    expect(factory.start).toHaveBeenCalledTimes(1)
    expect(handle.update).toHaveBeenCalledWith(
      expect.objectContaining({ lastOutput: 'still going' }),
    )
  })

  it('ends the activity when the session turns terminal', async () => {
    await openTurn('srv-1', session())
    const handle = factory.start.mock.results[0].value
    await reconcile('srv-1', session({ completedAt: '2026-07-25T11:00:00.000Z' }))
    expect(handle.end).toHaveBeenCalledWith('immediate')
  })

  it('never exceeds three activities, evicting the least recently updated', async () => {
    await openTurn('srv-1', session({ id: 'a' }))
    await openTurn('srv-1', session({ id: 'b' }))
    await openTurn('srv-1', session({ id: 'c' }))
    // Touch 'a' so 'b' becomes the least recently updated.
    await reconcile('srv-1', session({ id: 'a', lastOutput: 'fresh' }))

    const evicted = factory.start.mock.results[1].value
    await openTurn('srv-1', session({ id: 'd' }))

    expect(factory.start).toHaveBeenCalledTimes(4)
    expect(evicted.end).toHaveBeenCalledWith('immediate')
  })

  it('ignores a session that is neither live nor previously tracked', async () => {
    await reconcile('srv-1', session({ status: 'idle', ptyAttached: false }))
    expect(factory.start).not.toHaveBeenCalled()
  })

  it('keys by server so the same session id on two servers gets its own surface', async () => {
    await openTurn('srv-1', session())
    await openTurn('srv-2', session())
    expect(factory.start).toHaveBeenCalledTimes(2)
  })

  describe('adoption at app start', () => {
    it('ends surfaces left over from a previous launch', async () => {
      // Simulates a restart: raise a surface, then drop the in-memory tracking
      // the way a fresh JS context would, leaving the native activity behind.
      // A survivor carries no props back, so it can never be matched to a
      // session or updated — leaving it would freeze it on stale data.
      await openTurn('srv-1', session())
      const orphan = factory.start.mock.results[0].value
      resetLiveActivities()
      factory.getInstances.mockReturnValueOnce([orphan])

      adoptRunningActivities()

      expect(orphan.end).toHaveBeenCalledWith('immediate')
    })

    it('does not disturb a session started after adoption ran', async () => {
      adoptRunningActivities()
      await openTurn('srv-1', session())
      const handle = factory.start.mock.results[0].value
      expect(handle.end).not.toHaveBeenCalled()
    })
  })
})
