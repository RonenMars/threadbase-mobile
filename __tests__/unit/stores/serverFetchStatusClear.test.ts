import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'

describe('serverFetchStatus clearServer', () => {
  it('drops the entry so it cannot outlive the server it names', () => {
    useServerFetchStatusStore.setState({
      statuses: {
        keep: { status: 'error', error: 'a', lastCheckedAt: 0 },
        drop: { status: 'error', error: 'b', lastCheckedAt: 0 },
      },
    })

    useServerFetchStatusStore.getState().clearServer('drop')

    expect(Object.keys(useServerFetchStatusStore.getState().statuses)).toEqual(['keep'])
  })

  it('is a no-op for an unknown id', () => {
    const before = { keep: { status: 'error' as const, error: 'a', lastCheckedAt: 0 } }
    useServerFetchStatusStore.setState({ statuses: before })

    useServerFetchStatusStore.getState().clearServer('missing')

    expect(useServerFetchStatusStore.getState().statuses).toBe(before)
  })
})
