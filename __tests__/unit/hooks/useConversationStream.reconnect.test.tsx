import React, { type ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useConversationStream } from '@/hooks/useConversationStream'

type StatusListener = (serverId: string, s: string) => void

jest.mock('@/services/ws-client', () => {
  const statusListeners = new Set<StatusListener>()
  return {
    wsManager: {
      getClient: () => ({ on: () => () => {} }),
      onAnyStatusChange: (l: StatusListener) => {
        statusListeners.add(l)
        return () => statusListeners.delete(l)
      },
    },
    __wsTest: {
      emitStatus: (sid: string, s: string) => {
        statusListeners.forEach((l) => l(sid, s))
      },
    },
  }
})

const { __wsTest } = jest.requireMock('@/services/ws-client') as {
  __wsTest: { emitStatus: (sid: string, s: string) => void }
}

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidateSpy = jest.spyOn(qc, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const rendered = renderHook(() => useConversationStream('srv-1', 'sess-1', 'conv-1'), { wrapper })
  return { invalidateSpy, ...rendered }
}

describe('useConversationStream – reconnect recovery', () => {
  it('refetches the conversation when the WS comes back to connected', () => {
    const { invalidateSpy } = setup()
    // Mount performs the initial invalidation.
    expect(invalidateSpy).toHaveBeenCalledTimes(1)

    act(() => __wsTest.emitStatus('srv-1', 'connected'))
    expect(invalidateSpy).toHaveBeenCalledTimes(2)
    expect(invalidateSpy).toHaveBeenLastCalledWith({ queryKey: ['conversation', 'srv-1', 'conv-1'] })
  })

  it('ignores other servers and non-connected statuses', () => {
    const { invalidateSpy } = setup()
    invalidateSpy.mockClear()

    act(() => __wsTest.emitStatus('srv-2', 'connected'))
    act(() => __wsTest.emitStatus('srv-1', 'connecting'))
    act(() => __wsTest.emitStatus('srv-1', 'disconnected'))
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('stops listening after unmount', () => {
    const { invalidateSpy, unmount } = setup()
    invalidateSpy.mockClear()
    unmount()

    act(() => __wsTest.emitStatus('srv-1', 'connected'))
    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})
