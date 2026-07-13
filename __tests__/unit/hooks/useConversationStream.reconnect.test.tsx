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
      emitStatus: (sid: string, s: string) => statusListeners.forEach((l) => l(sid, s)),
    },
  }
})

const { __wsTest } = jest.requireMock('@/services/ws-client') as {
  __wsTest: { emitStatus: (sid: string, s: string) => void }
}

describe('useConversationStream — no longer touches the conversation query cache', () => {
  it('never calls invalidateQueries on mount or on WS reconnect', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    await renderHook(() => useConversationStream('srv-1', 'sess-1', 'conv-1'), { wrapper })
    expect(invalidateSpy).not.toHaveBeenCalled()

    await act(() => __wsTest.emitStatus('srv-1', 'connected'))
    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})
