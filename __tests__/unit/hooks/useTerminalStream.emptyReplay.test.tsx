import { renderHook, act } from '@testing-library/react-native'
import { useTerminalStream } from '@/hooks/useTerminalStream'
import { createWrapper } from '@/test-utils'

// ── Controllable wsManager fake ──────────────────────────────────────────────
// Mirrors useTerminalStream.watchdog.test.tsx: a message fires its typed
// handlers, then '*'. Lets us inject a terminal_replay frame at will.
type Handler = (msg: { type: string; sessionId?: string; lines?: string[] }) => void
type StatusListener = (serverId: string, s: string) => void

jest.mock('@/services/ws-client', () => {
  const handlers = new Map<string, Set<Handler>>()
  const statusListeners = new Set<StatusListener>()
  const fakeClient = {
    send: jest.fn(),
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
      emit: (msg: { type: string; sessionId?: string; lines?: string[] }) => {
        handlers.get(msg.type)?.forEach((h) => h(msg))
        handlers.get('*')?.forEach((h) => h(msg))
      },
      reset: () => {
        handlers.clear()
        statusListeners.clear()
      },
    },
  }
})

// HTTP fallback — the streamer's /output endpoint. Returns the full transcript
// the WS replay was missing. `mockApiGet` lets each test assert whether the fallback
// was consulted and hand back content.
const mockApiGet = jest.fn()
jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({ get: (...a: unknown[]) => mockApiGet(...a) }),
  NotFoundError: class NotFoundError extends Error {},
}))

const { __wsTest } = jest.requireMock('@/services/ws-client') as {
  __wsTest: {
    emit: (msg: { type: string; sessionId?: string; lines?: string[] }) => void
    reset: () => void
  }
}

const TERMINAL_REPLAY_TIMEOUT_MS = 2000

async function renderStream() {
  return await renderHook(() => useTerminalStream('srv-1', 'sess-1'), { wrapper: createWrapper() })
}

beforeEach(() => {
  jest.useFakeTimers()
  __wsTest.reset()
  mockApiGet.mockReset()
  mockApiGet.mockResolvedValue({ output: 'FULL TRANSCRIPT FROM HTTP\n' })
})

afterEach(() => {
  jest.useRealTimers()
})

describe('useTerminalStream – empty terminal_replay fallback', () => {
  it('falls back to HTTP /output when the WS replay carries no renderable lines', async () => {
    await renderStream()

    // Server unicasts a terminal_replay with only blank lines — the case a
    // card-parked session produces. This must NOT count as a successful load.
    await act(() => __wsTest.emit({ type: 'terminal_replay', sessionId: 'sess-1', lines: ['', '  ', ''] }))

    // The 2s fallback timer must still be armed → HTTP /output gets fetched.
    await act(async () => {
      jest.advanceTimersByTime(TERMINAL_REPLAY_TIMEOUT_MS)
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(mockApiGet).toHaveBeenCalledWith('/api/sessions/sess-1/output')
  })

  it('does NOT fall back when the WS replay carries real content', async () => {
    await renderStream()

    await act(() => __wsTest.emit({ type: 'terminal_replay', sessionId: 'sess-1', lines: ['hello world'] }))

    await act(async () => {
      jest.advanceTimersByTime(TERMINAL_REPLAY_TIMEOUT_MS)
    })
    await act(async () => {
      await Promise.resolve()
    })

    // A non-empty replay is authoritative — the HTTP fallback stays disabled.
    expect(mockApiGet).not.toHaveBeenCalled()
  })
})
