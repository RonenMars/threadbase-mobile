import { renderHook, act } from '@testing-library/react-native'
import { useTerminalStream } from '@/hooks/useTerminalStream'
import { createWrapper } from '@/test-utils'

// ── Controllable wsManager fake ──────────────────────────────────────────────
// Same shape as the userMessages suite's fake, plus terminal_replay's
// archivedLineCount and seq.
type WsMsg = {
  type: string
  sessionId?: string
  data?: string
  text?: string
  ts?: number
  lines?: string[]
  userMessages?: { text: string; ts: number }[]
  seq?: number
  archivedLineCount?: number
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

describe('useTerminalStream – history kept across clears', () => {
  it('seeds a replay\'s archived rows as history, not as the current frame', async () => {
    const { result } = await renderStream()
    await act(async () => {
      __wsTest.emit({
        type: 'terminal_replay',
        sessionId: 'sess-1',
        lines: ['before the clear', 'also before', 'frame row'],
        archivedLineCount: 2,
        seq: 1,
      })
    })
    expect(result.current.lines).toEqual(['before the clear', 'also before', 'frame row'])
    expect(result.current.frameLines).toEqual(['frame row'])
  })

  it('treats a replay without archivedLineCount as all frame, as older streamers meant it', async () => {
    const { result } = await renderStream()
    await act(async () => {
      __wsTest.emit({ type: 'terminal_replay', sessionId: 'sess-1', lines: ['one', 'two'], seq: 1 })
    })
    expect(result.current.lines).toEqual(['one', 'two'])
    expect(result.current.frameLines).toEqual(['one', 'two'])
  })

  it('clamps an archivedLineCount larger than the replay', async () => {
    const { result } = await renderStream()
    await act(async () => {
      __wsTest.emit({
        type: 'terminal_replay',
        sessionId: 'sess-1',
        lines: ['only row'],
        archivedLineCount: 9,
        seq: 1,
      })
    })
    expect(result.current.lines).toEqual(['only row'])
    expect(result.current.frameLines).toEqual([])
  })

  it('keeps the frame before a live clear as history, and the frame after as the frame', async () => {
    const { result } = await renderStream()
    await act(async () => {
      __wsTest.emit({ type: 'terminal_replay', sessionId: 'sess-1', lines: ['turn one'], seq: 1 })
    })
    await act(async () => {
      __wsTest.emit({
        type: 'terminal_output',
        sessionId: 'sess-1',
        data: '\x1b[2J\x1b[3J\x1b[Hrepainted frame',
        // Stamped like a real streamer so the seq guard accepts it.
        ...({ seq: 2 } as object),
      })
    })
    expect(result.current.lines).toEqual(['turn one', 'repainted frame'])
    expect(result.current.frameLines).toEqual(['repainted frame'])
  })
})
