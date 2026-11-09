import {
  FAILURE_BANNER_DELAY_MS,
  isServerFetchErrorVisible,
  useServerFetchStatusStore,
} from '@/stores/serverFetchStatus'

beforeEach(() => {
  jest.useFakeTimers()
  useServerFetchStatusStore.getState().reset()
})

afterEach(() => {
  useServerFetchStatusStore.getState().reset()
  jest.useRealTimers()
})

function recordPublishedFailure(serverId: string, error: unknown) {
  useServerFetchStatusStore.getState().recordFailure(serverId, error)
  jest.advanceTimersByTime(FAILURE_BANNER_DELAY_MS)
}

const status = (id: string) => useServerFetchStatusStore.getState().statuses[id]?.status

describe('useServerFetchStatusStore', () => {
  it('records success with timestamp', () => {
    const before = Date.now()
    useServerFetchStatusStore.getState().recordSuccess('srv-A')
    const entry = useServerFetchStatusStore.getState().statuses['srv-A']
    expect(entry?.status).toBe('ok')
    expect(entry?.error).toBeUndefined()
    expect(entry?.lastCheckedAt).toBeGreaterThanOrEqual(before)
  })

  it('records failure with stringified error message', () => {
    recordPublishedFailure('srv-A', new Error('host unreachable'))
    const entry = useServerFetchStatusStore.getState().statuses['srv-A']
    expect(entry?.status).toBe('error')
    expect(entry?.error).toBe('host unreachable')
  })

  it('handles non-Error rejection reasons (string, object)', () => {
    recordPublishedFailure('srv-A', 'plain string')
    expect(useServerFetchStatusStore.getState().statuses['srv-A']?.error).toBe('plain string')

    recordPublishedFailure('srv-B', { code: 'ETIMEDOUT' })
    expect(useServerFetchStatusStore.getState().statuses['srv-B']?.error).toContain('ETIMEDOUT')
  })

  it('a later success clears a prior failure for the same server', () => {
    recordPublishedFailure('srv-A', new Error('boom'))
    expect(useServerFetchStatusStore.getState().statuses['srv-A']?.status).toBe('error')
    useServerFetchStatusStore.getState().recordSuccess('srv-A')
    const entry = useServerFetchStatusStore.getState().statuses['srv-A']
    expect(entry?.status).toBe('ok')
    expect(entry?.error).toBeUndefined()
  })

  it('dismissFailure hides only the current failure episode', () => {
    recordPublishedFailure('srv-A', new Error('boom'))
    const first = useServerFetchStatusStore.getState().statuses['srv-A']!
    expect(isServerFetchErrorVisible(first, undefined)).toBe(true)

    useServerFetchStatusStore.getState().dismissFailure('srv-A')
    const dismissedAt = useServerFetchStatusStore.getState().dismissedFailureAt['srv-A']
    expect(isServerFetchErrorVisible(first, dismissedAt)).toBe(false)

    // distinct episodes need distinct timestamps; same-ms failures would look identical
    const now = jest.spyOn(Date, 'now').mockReturnValue(first.lastCheckedAt + 1)
    useServerFetchStatusStore.getState().recordFailure('srv-A', new Error('boom again'))
    now.mockRestore()
    const second = useServerFetchStatusStore.getState().statuses['srv-A']!
    expect(second.lastCheckedAt).not.toBe(first.lastCheckedAt)
    expect(isServerFetchErrorVisible(second, dismissedAt)).toBe(true)
  })

  it('recordSuccess is a no-op reference when the server is already ok', () => {
    useServerFetchStatusStore.getState().recordSuccess('srv-A')
    const first = useServerFetchStatusStore.getState().statuses
    useServerFetchStatusStore.getState().recordSuccess('srv-A')
    // Same object identity → zustand does not notify subscribers, so a
    // subscribed component does not re-render on an unchanged 'ok' status.
    expect(useServerFetchStatusStore.getState().statuses).toBe(first)
  })

  it('recordReady is a no-op reference when the server is already ok', () => {
    useServerFetchStatusStore.getState().recordReady('srv-A')
    const first = useServerFetchStatusStore.getState().statuses
    useServerFetchStatusStore.getState().recordReady('srv-A')
    expect(useServerFetchStatusStore.getState().statuses).toBe(first)
  })

  it('recordReady still clears a warming_up status to ok', () => {
    useServerFetchStatusStore.getState().recordWarmingUp('srv-A', 'startup')
    expect(useServerFetchStatusStore.getState().statuses['srv-A']?.status).toBe('warming_up')
    useServerFetchStatusStore.getState().recordReady('srv-A')
    expect(useServerFetchStatusStore.getState().statuses['srv-A']?.status).toBe('ok')
  })
  describe('failure delay', () => {
    it('publishes nothing until the delay has passed', () => {
      useServerFetchStatusStore.getState().recordFailure('srv-A', new Error('boom'))
      jest.advanceTimersByTime(FAILURE_BANNER_DELAY_MS - 1)
      expect(status('srv-A')).toBeUndefined()
      jest.advanceTimersByTime(1)
      expect(status('srv-A')).toBe('error')
    })

    it.each([
      ['recordSuccess', (id: string) => useServerFetchStatusStore.getState().recordSuccess(id), 'ok'],
      ['recordReady', (id: string) => useServerFetchStatusStore.getState().recordReady(id), 'ok'],
      ['recordWarmingUp', (id: string) => useServerFetchStatusStore.getState().recordWarmingUp(id, 'startup'), 'warming_up'],
    ] as const)('%s inside the window cancels the pending failure', (_name, act, expected) => {
      useServerFetchStatusStore.getState().recordFailure('srv-A', new Error('blip'))
      jest.advanceTimersByTime(FAILURE_BANNER_DELAY_MS - 1)
      act('srv-A')
      jest.advanceTimersByTime(FAILURE_BANNER_DELAY_MS)
      expect(status('srv-A')).toBe(expected)
    })

    it('clearServer and reset drop a pending failure', () => {
      useServerFetchStatusStore.getState().recordFailure('srv-A', new Error('x'))
      useServerFetchStatusStore.getState().recordFailure('srv-B', new Error('y'))
      useServerFetchStatusStore.getState().clearServer('srv-A')
      useServerFetchStatusStore.getState().reset()
      jest.advanceTimersByTime(FAILURE_BANNER_DELAY_MS)
      expect(useServerFetchStatusStore.getState().statuses).toEqual({})
    })

    it('a repeat failure does not push the pending one out', () => {
      useServerFetchStatusStore.getState().recordFailure('srv-A', new Error('first'))
      jest.advanceTimersByTime(FAILURE_BANNER_DELAY_MS - 1000)
      useServerFetchStatusStore.getState().recordFailure('srv-A', new Error('second'))
      jest.advanceTimersByTime(1000)
      expect(useServerFetchStatusStore.getState().statuses['srv-A']?.error).toBe('first')
    })

    it('a server already in error takes a new failure immediately', () => {
      recordPublishedFailure('srv-A', new Error('first'))
      useServerFetchStatusStore.getState().recordFailure('srv-A', new Error('second'))
      expect(useServerFetchStatusStore.getState().statuses['srv-A']?.error).toBe('second')
    })

    it('delays only the failing server', () => {
      useServerFetchStatusStore.getState().recordFailure('srv-A', new Error('x'))
      useServerFetchStatusStore.getState().recordSuccess('srv-B')
      jest.advanceTimersByTime(FAILURE_BANNER_DELAY_MS)
      expect(status('srv-A')).toBe('error')
      expect(status('srv-B')).toBe('ok')
    })
  })
})
