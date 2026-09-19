import React, { type ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useConversationStream } from '@/hooks/useConversationStream'

type ClientHandler = (msg: { type: string; sessionId: string; line: string }) => void

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
      emit: (type: string, msg: { type: string; sessionId: string; line: string }) => {
        clientListeners.get(type)?.forEach((l) => l(msg))
      },
    },
  }
})

const { __wsTest } = jest.requireMock('@/services/ws-client') as {
  __wsTest: { emit: (type: string, msg: { type: string; sessionId: string; line: string }) => void }
}

async function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return renderHook(() => useConversationStream('srv-1', 'sess-1', 'conv-1'), { wrapper })
}

describe('useConversationStream – user line parsing', () => {
  // Real Claude Code writes a typed user prompt with `content` as a bare string,
  // not an array of blocks. The live parser must render it as a user text bubble.
  it('renders a user conversation_event whose content is a plain string', async () => {
    const { result } = await setup()

    const line = JSON.stringify({
      type: 'user',
      uuid: 'u-1',
      timestamp: '2026-07-12T00:00:00.000Z',
      message: { role: 'user', content: 'hello there' },
    })
    await act(() => __wsTest.emit('conversation_event', { type: 'conversation_event', sessionId: 'sess-1', line }))

    expect(result.current.liveMessages).toHaveLength(1)
    expect(result.current.liveMessages[0]).toMatchObject({
      role: 'user',
      content: [{ type: 'text', text: 'hello there' }],
    })
  })
})

// Lines as streamer 1.98.0's toClaudeShapedLine emits them for a Codex
// exec_command call and its output (separate messages, paired by call_id).
describe('useConversationStream – Codex tool call pairing', () => {
  it('keeps the tool_use id and the tool_result tool_use_id', async () => {
    const { result } = await setup()

    const call = JSON.stringify({
      type: 'assistant',
      uuid: 'fc_0a1b2c3d4e5f60718293a4b5',
      timestamp: '2026-09-19T08:12:03.411Z',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'call_Xk2mP9qR4tV7wY1zB3dF6hJ8',
            name: 'exec_command',
            input: { cmd: 'npm run typecheck', workdir: '/Users/dev/tb-mobile' },
          },
        ],
      },
    })
    const output = JSON.stringify({
      type: 'user',
      uuid: 'fco_0a1b2c3d4e5f60718293a4b6',
      timestamp: '2026-09-19T08:12:09.027Z',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'call_Xk2mP9qR4tV7wY1zB3dF6hJ8',
            content: '> threadbase-mobile@1.0.0 typecheck\n> tsc --noEmit\n',
            is_error: false,
          },
        ],
      },
    })
    await act(() => __wsTest.emit('conversation_event', { type: 'conversation_event', sessionId: 'sess-1', line: call }))
    await act(() => __wsTest.emit('conversation_event', { type: 'conversation_event', sessionId: 'sess-1', line: output }))

    expect(result.current.liveMessages.map((m) => m.content[0])).toEqual([
      expect.objectContaining({ type: 'tool_use', id: 'call_Xk2mP9qR4tV7wY1zB3dF6hJ8', name: 'exec_command' }),
      expect.objectContaining({ type: 'tool_result', toolUseId: 'call_Xk2mP9qR4tV7wY1zB3dF6hJ8' }),
    ])
  })
})
