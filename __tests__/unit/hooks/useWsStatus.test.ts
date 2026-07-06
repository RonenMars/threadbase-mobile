import { renderHook, act } from '@testing-library/react-native'
import { useWsStatus } from '@/hooks/useWsStatus'

type StatusListener = (serverId: string, s: string) => void

jest.mock('@/services/ws-client', () => {
  const statusListeners = new Set<StatusListener>()
  let currentStatus = 'disconnected'
  return {
    wsManager: {
      status: () => currentStatus,
      onAnyStatusChange: (l: StatusListener) => {
        statusListeners.add(l)
        return () => statusListeners.delete(l)
      },
    },
    __wsTest: {
      setStatus: (s: string) => {
        currentStatus = s
      },
      emitStatus: (sid: string, s: string) => {
        statusListeners.forEach((l) => l(sid, s))
      },
      listenerCount: () => statusListeners.size,
    },
  }
})

const { __wsTest } = jest.requireMock('@/services/ws-client') as {
  __wsTest: {
    setStatus: (s: string) => void
    emitStatus: (sid: string, s: string) => void
    listenerCount: () => number
  }
}

describe('useWsStatus', () => {
  it('seeds from the manager and tracks status events for its server', async () => {
    __wsTest.setStatus('connected')
    const { result } = await renderHook(() => useWsStatus('srv-1'))
    expect(result.current).toBe('connected')

    await act(() => __wsTest.emitStatus('srv-1', 'disconnected'))
    expect(result.current).toBe('disconnected')

    await act(() => __wsTest.emitStatus('srv-1', 'connecting'))
    expect(result.current).toBe('connecting')
  })

  it('ignores status events for other servers', async () => {
    __wsTest.setStatus('connected')
    const { result } = await renderHook(() => useWsStatus('srv-1'))

    await act(() => __wsTest.emitStatus('srv-2', 'disconnected'))
    expect(result.current).toBe('connected')
  })

  it('unsubscribes on unmount', async () => {
    const { unmount } = await renderHook(() => useWsStatus('srv-1'))
    expect(__wsTest.listenerCount()).toBe(1)
    await unmount()
    expect(__wsTest.listenerCount()).toBe(0)
  })
})
