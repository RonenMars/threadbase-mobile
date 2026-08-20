import { renderHook, act } from '@testing-library/react-native'
import { useTerminalStream } from '@/hooks/useTerminalStream'
import { createWrapper } from '@/test-utils'

// ── Controllable wsManager fake ──────────────────────────────────────────────
// Same shape as the userMessages test's fake, extended with `seq`.
type WsMsg = {
  type: string
  sessionId?: string
  data?: string
  lines?: string[]
  seq?: number
}
type Handler = (msg: WsMsg) => void
type StatusListener = (serverId: string, s: string) => void

jest.mock('@/services/ws-client', () => {
  const handlers = new Map<string, Set<Handler>>()
  const statusListeners = new Set<StatusListener>()
  const send = jest.fn()
  const fakeClient = {
    send,
    status: () => 'connected',
    on: (type: string, h: Handler) => {
      if (!handlers.has(type)) handlers.set(type, new Set())
      handlers.get(type)!.add(h)
      return () => handlers.get(type)?.delete(h)
    },
  }
  return {
    wsManager: {
      getClient: () => fakeClient,
      forceReconnect: jest.fn(),
      status: () => 'connected',
      onAnyStatusChange: (l: StatusListener) => {
        statusListeners.add(l)
        return () => statusListeners.delete(l)
      },
      acquireSession: jest.fn((_serverId: string, sessionId: string) => {
        send({ type: 'subscribe_session', sessionId })
      }),
      releaseSession: jest.fn((_serverId: string, sessionId: string) => {
        send({ type: 'unsubscribe_session', sessionId })
      }),
    },
    __wsTest: {
      send,
      emit: (msg: WsMsg) => {
        handlers.get(msg.type)?.forEach((h) => h(msg))
        handlers.get('*')?.forEach((h) => h(msg))
      },
      emitStatus: (sid: string, s: string) => statusListeners.forEach((l) => l(sid, s)),
      reset: () => {
        handlers.clear()
        statusListeners.clear()
        send.mockClear()
      },
    },
  }
})

jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({ get: jest.fn().mockResolvedValue({ output: '' }) }),
  NotFoundError: class NotFoundError extends Error {},
}))

const { __wsTest } = jest.requireMock('@/services/ws-client') as {
  __wsTest: {
    send: jest.Mock
    emit: (msg: WsMsg) => void
    emitStatus: (serverId: string, s: string) => void
    reset: () => void
  }
}

async function renderStream() {
  return await renderHook(() => useTerminalStream('srv-1', 'sess-1'), { wrapper: createWrapper() })
}

beforeEach(() => {
  jest.useFakeTimers()
  __wsTest.reset()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('useTerminalStream – seq guard', () => {
  it('accepts terminal_output chunks with increasing seq', async () => {
    const { result } = await renderStream()

    await act(() => __wsTest.emit({ type: 'terminal_output', sessionId: 'sess-1', data: 'one\n', seq: 1 }))
    await act(() => __wsTest.emit({ type: 'terminal_output', sessionId: 'sess-1', data: 'two\n', seq: 2 }))

    expect(result.current.lines.join('\n')).toContain('one')
    expect(result.current.lines.join('\n')).toContain('two')
  })

  it('drops a stale chunk whose seq is not greater than the last accepted seq', async () => {
    const { result } = await renderStream()

    await act(() => __wsTest.emit({ type: 'terminal_output', sessionId: 'sess-1', data: 'fresh\n', seq: 5 }))
    // A late frame from a superseded connection, arriving after a newer seq.
    await act(() => __wsTest.emit({ type: 'terminal_output', sessionId: 'sess-1', data: 'STALE\n', seq: 3 }))

    expect(result.current.lines.join('\n')).not.toContain('STALE')
    expect(result.current.lines.join('\n')).toContain('fresh')
  })

  it('baselines the seq guard from terminal_replay before accepting further chunks', async () => {
    const { result } = await renderStream()

    await act(() =>
      __wsTest.emit({ type: 'terminal_replay', sessionId: 'sess-1', lines: ['replayed'], seq: 10 })
    )
    // Stale relative to the replay baseline — must be dropped.
    await act(() => __wsTest.emit({ type: 'terminal_output', sessionId: 'sess-1', data: 'STALE\n', seq: 7 }))
    await act(() => __wsTest.emit({ type: 'terminal_output', sessionId: 'sess-1', data: 'fresh\n', seq: 11 }))

    expect(result.current.lines.join('\n')).not.toContain('STALE')
    expect(result.current.lines.join('\n')).toContain('fresh')
  })

  it('never rejects chunks from a streamer that omits seq (backward compat)', async () => {
    const { result } = await renderStream()

    await act(() => __wsTest.emit({ type: 'terminal_output', sessionId: 'sess-1', data: 'one\n' }))
    await act(() => __wsTest.emit({ type: 'terminal_output', sessionId: 'sess-1', data: 'two\n' }))

    expect(result.current.lines.join('\n')).toContain('one')
    expect(result.current.lines.join('\n')).toContain('two')
  })

  it('unsubscribes the session stream when the view unmounts', async () => {
    const { unmount } = await renderStream()
    const { wsManager } = jest.requireMock('@/services/ws-client') as {
      wsManager: { acquireSession: jest.Mock; releaseSession: jest.Mock }
    }
    expect(wsManager.acquireSession).toHaveBeenCalledWith('srv-1', 'sess-1')
    await act(() => {
      unmount()
    })
    expect(wsManager.releaseSession).toHaveBeenCalledWith('srv-1', 'sess-1')
  })
})
