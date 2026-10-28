import { isServerFetchErrorVisible, useServerFetchStatusStore } from '@/stores/serverFetchStatus'

beforeEach(() => {
  useServerFetchStatusStore.getState().reset()
})

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
    useServerFetchStatusStore.getState().recordFailure('srv-A', new Error('host unreachable'))
    const entry = useServerFetchStatusStore.getState().statuses['srv-A']
    expect(entry?.status).toBe('error')
    expect(entry?.error).toBe('host unreachable')
  })

  it('handles non-Error rejection reasons (string, object)', () => {
    useServerFetchStatusStore.getState().recordFailure('srv-A', 'plain string')
    expect(useServerFetchStatusStore.getState().statuses['srv-A']?.error).toBe('plain string')

    useServerFetchStatusStore.getState().recordFailure('srv-B', { code: 'ETIMEDOUT' })
    expect(useServerFetchStatusStore.getState().statuses['srv-B']?.error).toContain('ETIMEDOUT')
  })

  it('a later success clears a prior failure for the same server', () => {
    useServerFetchStatusStore.getState().recordFailure('srv-A', new Error('boom'))
    expect(useServerFetchStatusStore.getState().statuses['srv-A']?.status).toBe('error')
    useServerFetchStatusStore.getState().recordSuccess('srv-A')
    const entry = useServerFetchStatusStore.getState().statuses['srv-A']
    expect(entry?.status).toBe('ok')
    expect(entry?.error).toBeUndefined()
  })

  it('dismissFailure hides only the current failure episode', () => {
    useServerFetchStatusStore.getState().recordFailure('srv-A', new Error('boom'))
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
})
