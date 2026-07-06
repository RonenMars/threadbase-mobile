import React, { type ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useConversationStream } from '@/hooks/useConversationStream'
import type { Session } from '@/types/api'

type ClientHandler = (msg: { type: string; session: Session }) => void

jest.mock('@/services/ws-client', () => {
  const clientListeners = new Map<string, Set<ClientHandler>>()
  return {
    wsManager: {
      getClient: () => ({
        on: (type: string, handler: ClientHandler) => {
          if (!clientListeners.has(type)) clientListeners.set(type, new Set())
          clientListeners.get(type)!.add(handler)
          return () => clientListeners.get(type)!.delete(handler)
        },
      }),
      onAnyStatusChange: () => () => {},
    },
    __wsTest: {
      emit: (type: string, msg: { type: string; session: Session }) => {
        clientListeners.get(type)?.forEach((l) => l(msg))
      },
    },
  }
})

const { __wsTest } = jest.requireMock('@/services/ws-client') as {
  __wsTest: { emit: (type: string, msg: { type: string; session: Partial<Session> }) => void }
}

function sessionUpdate(id: string, status: Session['status']) {
  return { type: 'session_update', session: { id, status } as Session }
}

async function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidateSpy = jest.spyOn(qc, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const rendered = await renderHook(() => useConversationStream('srv-1', 'sess-1', 'conv-1'), { wrapper })
  return { invalidateSpy, ...rendered }
}

describe('useConversationStream – refetch on session status transition', () => {
  it('refetches the conversation when the session leaves running', async () => {
    const { invalidateSpy } = await setup()
    invalidateSpy.mockClear()

    await act(() => __wsTest.emit('session_update', sessionUpdate('sess-1', 'running')))
    expect(invalidateSpy).not.toHaveBeenCalled()

    await act(() => __wsTest.emit('session_update', sessionUpdate('sess-1', 'waiting_input')))
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
    expect(invalidateSpy).toHaveBeenLastCalledWith({ queryKey: ['conversation', 'srv-1', 'conv-1'] })
  })

  it('refetches on running → idle too', async () => {
    const { invalidateSpy } = await setup()
    invalidateSpy.mockClear()

    await act(() => __wsTest.emit('session_update', sessionUpdate('sess-1', 'running')))
    await act(() => __wsTest.emit('session_update', sessionUpdate('sess-1', 'idle')))
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
  })

  it('does not refetch without a prior running status (e.g. first update is waiting_input)', async () => {
    const { invalidateSpy } = await setup()
    invalidateSpy.mockClear()

    await act(() => __wsTest.emit('session_update', sessionUpdate('sess-1', 'waiting_input')))
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('ignores other sessions and repeated non-running statuses', async () => {
    const { invalidateSpy } = await setup()
    invalidateSpy.mockClear()

    await act(() => __wsTest.emit('session_update', sessionUpdate('sess-2', 'running')))
    await act(() => __wsTest.emit('session_update', sessionUpdate('sess-2', 'idle')))
    await act(() => __wsTest.emit('session_update', sessionUpdate('sess-1', 'idle')))
    await act(() => __wsTest.emit('session_update', sessionUpdate('sess-1', 'waiting_input')))
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('stops listening after unmount', async () => {
    const { invalidateSpy, unmount } = await setup()
    invalidateSpy.mockClear()

    await act(() => __wsTest.emit('session_update', sessionUpdate('sess-1', 'running')))
    await unmount()
    await act(() => __wsTest.emit('session_update', sessionUpdate('sess-1', 'idle')))
    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})
