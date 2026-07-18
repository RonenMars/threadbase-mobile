import { renderHook, act } from '@testing-library/react-native'
import { useTerminalStream } from '@/hooks/useTerminalStream'
import { createWrapper } from '@/test-utils'

// ── Controllable wsManager fake ──────────────────────────────────────────────
// Same shape as the watchdog test's fake, but its message type carries the
// user_message / terminal_replay fields this suite exercises.
type WsMsg = {
  type: string
  sessionId?: string
  data?: string
  text?: string
  ts?: number
  lines?: string[]
  userMessages?: { text: string; ts: number }[]
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
    },
    __wsTest: {
      send,
      emit: (msg: WsMsg) => {
        handlers.get(msg.type)?.forEach((h) => h(msg))
        handlers.get('*')?.forEach((h) => h(msg))
      },
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
  __wsTest: { send: jest.Mock; emit: (msg: WsMsg) => void; reset: () => void }
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

describe('useTerminalStream – userMessageTexts', () => {
  it('starts empty', async () => {
    const { result } = await renderStream()
    expect(result.current.userMessageTexts.size).toBe(0)
  })

  it('collects live user_message events (trimmed) for this session only', async () => {
    const { result } = await renderStream()

    await act(() => __wsTest.emit({ type: 'user_message', sessionId: 'sess-1', text: '  hello  ', ts: 1 }))
    await act(() => __wsTest.emit({ type: 'user_message', sessionId: 'other', text: 'ignored', ts: 2 }))

    expect([...result.current.userMessageTexts]).toEqual(['hello'])
  })

  it('additively merges terminal_replay.userMessages', async () => {
    const { result } = await renderStream()

    await act(() => __wsTest.emit({ type: 'user_message', sessionId: 'sess-1', text: 'live one', ts: 1 }))
    await act(() =>
      __wsTest.emit({
        type: 'terminal_replay',
        sessionId: 'sess-1',
        lines: ['❯ live one', '❯ replayed'],
        userMessages: [
          { text: 'live one', ts: 1 },
          { text: 'replayed', ts: 2 },
        ],
      })
    )

    expect(result.current.userMessageTexts).toEqual(new Set(['live one', 'replayed']))
  })

  it('tolerates terminal_replay with no userMessages field (old streamer)', async () => {
    const { result } = await renderStream()

    await act(() =>
      __wsTest.emit({ type: 'terminal_replay', sessionId: 'sess-1', lines: ['❯ heuristic only'] })
    )

    expect(result.current.userMessageTexts.size).toBe(0)
  })
})
