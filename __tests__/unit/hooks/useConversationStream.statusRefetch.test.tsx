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

// A plural conversation_events frame with two message lines, seqs [10, 11].
function pluralFrame(sessionId: string, texts: string[], seqs: (number | null)[]): Extract<WSMessage, { type: 'conversation_events' }> {
  return {
    type: 'conversation_events',
    sessionId,
    lines: texts.map((t, i) => JSON.stringify({ type: 'assistant', uuid: `u${i}`, message: { role: 'assistant', content: [{ type: 'text', text: t }] } })),
    seqs,
  }
}
function singularFrame(sessionId: string, uuid: string, text: string): Extract<WSMessage, { type: 'conversation_event' }> {
  return {
    type: 'conversation_event',
    sessionId,
    line: JSON.stringify({ type: 'assistant', uuid, message: { role: 'assistant', content: [{ type: 'text', text }] } }),
  }
}

describe('useConversationStream — seq indexing (item 3)', () => {
  function setup() {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
    )
    return renderHook(() => useConversationStream('srv-1', 'sess-1', 'conv-1'), { wrapper })
  }

  it('sets messageIndex from seqs on plural-frame messages; null seq → no index', async () => {
    const { result } = await setup()
    await act(() => __wsTest.emit('conversation_events', pluralFrame('sess-1', ['a', 'b'], [10, null])))
    expect(result.current.liveMessages).toHaveLength(2)
    expect(result.current.liveMessages[0].messageIndex).toBe(10)
    expect(result.current.liveMessages[1].messageIndex).toBeUndefined()
  })

  it('plural wins the race: the seq-carrying copy is kept, the trailing singular (same uuid) dedupes away', async () => {
    const { result } = await setup()
    // Plural first (as the server broadcasts), then the singular for the same uuid.
    await act(() => __wsTest.emit('conversation_events', pluralFrame('sess-1', ['hello'], [7])))
    await act(() => __wsTest.emit('conversation_event', singularFrame('sess-1', 'u0', 'hello')))
    expect(result.current.liveMessages).toHaveLength(1)
    expect(result.current.liveMessages[0].messageIndex).toBe(7)
  })

  it('old server (singular only) → message has no index, overlay is non-empty', async () => {
    const { result } = await setup()
    await act(() => __wsTest.emit('conversation_event', singularFrame('sess-1', 'u9', 'hi')))
    expect(result.current.liveMessages).toHaveLength(1)
    expect(result.current.liveMessages[0].messageIndex).toBeUndefined()
  })

  it('codex (plural frame without seqs field) → messages have no index, no error', async () => {
    const { result } = await setup()
    const frame: Extract<WSMessage, { type: 'conversation_events' }> = {
      type: 'conversation_events',
      sessionId: 'sess-1',
      lines: [JSON.stringify({ type: 'assistant', uuid: 'c0', message: { role: 'assistant', content: [{ type: 'text', text: 'x' }] } })],
    }
    await act(() => __wsTest.emit('conversation_events', frame))
    expect(result.current.liveMessages).toHaveLength(1)
    expect(result.current.liveMessages[0].messageIndex).toBeUndefined()
  })

  it('ignores plural frames for other sessions', async () => {
    const { result } = await setup()
    await act(() => __wsTest.emit('conversation_events', pluralFrame('other-sess', ['a'], [1])))
    expect(result.current.liveMessages).toHaveLength(0)
  })
})


describe('useConversationStream — raw Codex rollout lines', () => {
  async function setup() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    return renderHook(() => useConversationStream('srv-1', 'sess-1', 'conv-1'), { wrapper })
  }

  it('parses Codex response_item user/assistant into live messages', async () => {
    const { result } = await setup()
    const userLine = JSON.stringify({
      timestamp: '2026-07-15T11:01:16.649Z',
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'Hello from mobile' }],
      },
    })
    const assistantLine = JSON.stringify({
      timestamp: '2026-07-15T11:01:20.000Z',
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'Hi there' }],
      },
    })
    await act(() =>
      __wsTest.emit('conversation_events', {
        type: 'conversation_events',
        sessionId: 'sess-1',
        lines: [userLine, assistantLine],
      }),
    )
    expect(result.current.liveMessages).toHaveLength(2)
    expect(result.current.liveMessages[0].role).toBe('user')
    expect(result.current.liveMessages[0].content).toEqual([{ type: 'text', text: 'Hello from mobile' }])
    expect(result.current.liveMessages[1].role).toBe('assistant')
  })

  it('drops session_meta, event_msg duplicates, and AGENTS.md injected user turns', async () => {
    const { result } = await setup()
    await act(() =>
      __wsTest.emit('conversation_events', {
        type: 'conversation_events',
        sessionId: 'sess-1',
        lines: [
          JSON.stringify({ type: 'session_meta', payload: { id: 'c1' } }),
          JSON.stringify({
            type: 'response_item',
            payload: {
              type: 'message',
              role: 'user',
              content: [{ type: 'input_text', text: '# AGENTS.md instructions\n\n<INSTRUCTIONS>\nx' }],
            },
          }),
          JSON.stringify({
            type: 'event_msg',
            payload: { type: 'user_message', message: 'real' },
          }),
          JSON.stringify({
            type: 'response_item',
            payload: {
              type: 'message',
              role: 'user',
              content: [{ type: 'input_text', text: 'real question' }],
            },
          }),
        ],
      }),
    )
    expect(result.current.liveMessages).toHaveLength(1)
    expect(result.current.liveMessages[0].content).toEqual([{ type: 'text', text: 'real question' }])
  })

  it('drops streamer DEFAULT system prompt injected as a user turn', async () => {
    const { result } = await setup()
    await act(() =>
      __wsTest.emit('conversation_events', {
        type: 'conversation_events',
        sessionId: 'sess-1',
        lines: [
          JSON.stringify({
            type: 'response_item',
            payload: {
              type: 'message',
              role: 'user',
              content: [{
                type: 'input_text',
                text: 'When presenting options or choices to the user, limit the options to at most 3.',
              }],
            },
          }),
          JSON.stringify({
            type: 'response_item',
            payload: {
              type: 'message',
              role: 'user',
              content: [{ type: 'input_text', text: 'real question' }],
            },
          }),
        ],
      }),
    )
    expect(result.current.liveMessages).toHaveLength(1)
    expect(result.current.liveMessages[0].content).toEqual([{ type: 'text', text: 'real question' }])
  })
})
