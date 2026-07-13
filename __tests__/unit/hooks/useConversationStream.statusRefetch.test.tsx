import React, { type ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useConversationStream } from '@/hooks/useConversationStream'
import type { Session } from '@/types/api'
import type { WSMessage } from '@/services/ws-client'

type Handler = (msg: WSMessage) => void

jest.mock('@/services/ws-client', () => {
  const listeners = new Map<string, Set<Handler>>()
  return {
    wsManager: {
      getClient: () => ({
        on: (type: string, handler: Handler) => {
          if (!listeners.has(type)) listeners.set(type, new Set())
          listeners.get(type)!.add(handler)
          return () => listeners.get(type)!.delete(handler)
        },
      }),
      onAnyStatusChange: () => () => {},
    },
    __wsTest: {
      emit: (type: string, msg: WSMessage) => listeners.get(type)?.forEach((l) => l(msg)),
    },
  }
})

const { __wsTest } = jest.requireMock('@/services/ws-client') as {
  __wsTest: { emit: (type: string, msg: WSMessage) => void }
}

function sessionUpdate(id: string, status: Session['status']): Extract<WSMessage, { type: 'session_update' }> {
  return { type: 'session_update', session: { id, status } as Session }
}

describe('useConversationStream — session transitions do not touch the cache', () => {
  it('never invalidates on running → waiting_input', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    await renderHook(() => useConversationStream('srv-1', 'sess-1', 'conv-1'), { wrapper })

    await act(() => __wsTest.emit('session_update', sessionUpdate('sess-1', 'running')))
    await act(() => __wsTest.emit('session_update', sessionUpdate('sess-1', 'waiting_input')))
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('still appends live conversation_event messages', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const { result } = await renderHook(
      () => useConversationStream('srv-1', 'sess-1', 'conv-1'),
      { wrapper },
    )

    await act(() =>
      __wsTest.emit('conversation_event', {
        type: 'conversation_event',
        sessionId: 'sess-1',
        line: JSON.stringify({ type: 'assistant', uuid: 'u1', message: { role: 'assistant', content: [{ type: 'text', text: 'hi' }] } }),
      }),
    )
    expect(result.current.liveMessages).toHaveLength(1)
    expect(result.current.liveMessages[0].uuid).toBe('u1')
  })
})
