import { renderHook, act } from '@testing-library/react-native'
import { useTerminalStream } from '@/hooks/useTerminalStream'
import { createWrapper } from '@/test-utils'

// ── Controllable wsManager fake ──────────────────────────────────────────────
// Mimics the real dispatch: a message fires its typed handlers, then '*'.
type Handler = (msg: { type: string; sessionId?: string; data?: string; lines?: string[] }) => void

type StatusListener = (serverId: string, s: string) => void
type WatchdogMsg = { type: string; sessionId?: string; data?: string; ts?: number }

jest.mock('@/services/ws-client', () => {
  const handlers = new Map<string, Set<Handler>>()
  const statusListeners = new Set<StatusListener>()
  const forceReconnect = jest.fn()
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
      forceReconnect,
      status: () => 'connected',
      onAnyStatusChange: (l: StatusListener) => {
        statusListeners.add(l)
        return () => statusListeners.delete(l)
      },
    },
    __wsTest: {
      forceReconnect,
      emit: (msg: WatchdogMsg) => {
        handlers.get(msg.type)?.forEach((h) => h(msg))
        handlers.get('*')?.forEach((h) => h(msg))
      },
      reset: () => {
        handlers.clear()
        statusListeners.clear()
        forceReconnect.mockClear()
      },
      emitStatus: (sid: string, s: string) => {
        statusListeners.forEach((l) => l(sid, s))
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
    forceReconnect: jest.Mock
    emit: (msg: { type: string; sessionId?: string; data?: string; ts?: number }) => void
    reset: () => void
    emitStatus: (serverId: string, s: string) => void
  }
}

const WS_SILENCE_TIMEOUT_MS = 45_000

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

describe('useTerminalStream – silence watchdog', () => {
  it('forces a reconnect after 45s of total WS silence', async () => {
    await renderStream()

    await act(() => jest.advanceTimersByTime(WS_SILENCE_TIMEOUT_MS - 1))
    expect(__wsTest.forceReconnect).not.toHaveBeenCalled()

    await act(() => jest.advanceTimersByTime(1))
    expect(__wsTest.forceReconnect).toHaveBeenCalledTimes(1)
    expect(__wsTest.forceReconnect).toHaveBeenCalledWith('srv-1')
  })

  it('any inbound message resets the silence timer', async () => {
    await renderStream()

    await act(() => jest.advanceTimersByTime(30_000))
    // A message for an unrelated session still proves the socket is alive.
    await act(() => __wsTest.emit({ type: 'session_update', sessionId: 'other' }))

    // 30s since the message (60s since mount) — must NOT have fired.
    await act(() => jest.advanceTimersByTime(30_000))
    expect(__wsTest.forceReconnect).not.toHaveBeenCalled()

    // 45s after the last message — fires.
    await act(() => jest.advanceTimersByTime(15_000))
    expect(__wsTest.forceReconnect).toHaveBeenCalledTimes(1)
  })

  // A WebSocket protocol ping never reaches JS, so an app-level ping is the
  // only liveness signal an idle socket has. Pinned separately from the
  // "any inbound message" case so the wildcard reset can never be narrowed to
  // session traffic without this going red (#946).
  it('a server ping frame with no session payload resets the silence timer', async () => {
    await renderStream()

    // Server cadence is 30 s; three pings without any session traffic.
    for (let i = 0; i < 3; i++) {
      await act(() => jest.advanceTimersByTime(30_000))
      await act(() => __wsTest.emit({ type: 'ping', ts: Date.now() }))
    }
    expect(__wsTest.forceReconnect).not.toHaveBeenCalled()

    // Pings stop: 45 s after the last one, the watchdog fires.
    await act(() => jest.advanceTimersByTime(WS_SILENCE_TIMEOUT_MS))
    expect(__wsTest.forceReconnect).toHaveBeenCalledTimes(1)
  })

  it('steady message flow keeps the watchdog silent indefinitely', async () => {
    await renderStream()

    for (let i = 0; i < 5; i++) {
      await act(() => jest.advanceTimersByTime(40_000))
      await act(() => __wsTest.emit({ type: 'terminal_output', sessionId: 'sess-1', data: 'x' }))
    }
    expect(__wsTest.forceReconnect).not.toHaveBeenCalled()
  })

  it('re-arms after firing so a still-dead connection is retried', async () => {
    await renderStream()

    await act(() => jest.advanceTimersByTime(WS_SILENCE_TIMEOUT_MS))
    expect(__wsTest.forceReconnect).toHaveBeenCalledTimes(1)

    // Connection stays dark (no messages, no status change) — the watchdog
    // must keep retrying instead of going silent after the first attempt.
    await act(() => jest.advanceTimersByTime(WS_SILENCE_TIMEOUT_MS))
    expect(__wsTest.forceReconnect).toHaveBeenCalledTimes(2)
  })

  it('re-arms via the connected status event after a successful reconnect', async () => {
    await renderStream()

    await act(() => jest.advanceTimersByTime(WS_SILENCE_TIMEOUT_MS))
    expect(__wsTest.forceReconnect).toHaveBeenCalledTimes(1)

    await act(() => __wsTest.emitStatus('srv-1', 'connected'))
    await act(() => jest.advanceTimersByTime(WS_SILENCE_TIMEOUT_MS))
    expect(__wsTest.forceReconnect).toHaveBeenCalledTimes(2)
  })

  it('unmount clears the watchdog', async () => {
    const { unmount } = await renderStream()
    await unmount()

    await act(() => jest.advanceTimersByTime(WS_SILENCE_TIMEOUT_MS * 2))
    expect(__wsTest.forceReconnect).not.toHaveBeenCalled()
  })
})
