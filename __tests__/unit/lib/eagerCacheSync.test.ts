import { QueryClient } from '@tanstack/react-query'
import { applySessionUpdateToEagerCache, refreshEagerConversations } from '@/lib/eagerCacheSync'
import type { MultiSession, Session } from '@/types/api'

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1',
    status: 'idle',
    ptyAttached: false,
    projectPath: '/tmp/p',
    projectName: 'p',
    lastOutput: '',
    elapsedMs: 0,
    promptCount: 0,
    startedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const EAGER_KEY = ['sessions-eager', undefined, 'startedAt', 'all', 'srv1'] as const

describe('applySessionUpdateToEagerCache', () => {
  it('patches an existing row in place without invalidating', () => {
    const qc = new QueryClient()
    const existing: MultiSession[] = [
      { ...makeSession({ id: 'sess-1', status: 'running' }), serverId: 'srv1' },
    ]
    qc.setQueryData(EAGER_KEY, existing)
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries')

    applySessionUpdateToEagerCache(qc, 'srv1', makeSession({ id: 'sess-1', status: 'waiting_input' }))

    const next = qc.getQueryData<MultiSession[]>(EAGER_KEY)
    expect(next?.[0].status).toBe('waiting_input')
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('invalidates when the session is not in any eager list yet', () => {
    const qc = new QueryClient()
    qc.setQueryData(EAGER_KEY, [
      { ...makeSession({ id: 'other' }), serverId: 'srv1' },
    ] as MultiSession[])
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries')

    applySessionUpdateToEagerCache(
      qc,
      'srv1',
      makeSession({ id: 'new-external', ownership: 'external', processLiveness: 'alive' }),
    )

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['sessions-eager'] })
    // The non-matching list is left untouched (no blind insert).
    expect(qc.getQueryData<MultiSession[]>(EAGER_KEY)).toHaveLength(1)
  })

  it('does not match a same-id row on a different server', () => {
    const qc = new QueryClient()
    qc.setQueryData(EAGER_KEY, [
      { ...makeSession({ id: 'sess-1' }), serverId: 'srv1' },
    ] as MultiSession[])
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries')

    applySessionUpdateToEagerCache(qc, 'srv2', makeSession({ id: 'sess-1' }))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['sessions-eager'] })
  })
})

describe('refreshEagerConversations', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('invalidates the eager conversations list after the debounce window', () => {
    const qc = new QueryClient()
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries')

    refreshEagerConversations(qc)
    // Debounced: not fired synchronously — a chatty server must not re-drain
    // every page on every conversation_updated frame.
    expect(invalidateSpy).not.toHaveBeenCalled()

    jest.advanceTimersByTime(1000)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['conversations-eager'] })
  })

  it('coalesces a burst of frames into a single re-drain', () => {
    const qc = new QueryClient()
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries')

    refreshEagerConversations(qc)
    refreshEagerConversations(qc)
    refreshEagerConversations(qc)
    jest.advanceTimersByTime(1000)

    expect(invalidateSpy).toHaveBeenCalledTimes(1)
  })
})
