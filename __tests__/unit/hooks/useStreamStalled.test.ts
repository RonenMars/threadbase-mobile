import { renderHook, act } from '@testing-library/react-native'
import { useStreamStalled, STREAM_STALL_TIMEOUT_MS } from '@/hooks/useStreamStalled'

type Handler = (msg: { type: string; sessionId?: string; data?: string }) => void
type StalledMsg = { type: string; sessionId?: string; data?: string }

jest.mock('@/services/ws-client', () => {
  const handlers = new Map<string, Set<Handler>>()
  const fakeClient = {
    on: (type: string, h: Handler) => {
      if (!handlers.has(type)) handlers.set(type, new Set())
      handlers.get(type)!.add(h)
      return () => handlers.get(type)?.delete(h)
    },
  }
  return {
    wsManager: {
      getClient: () => fakeClient,
    },
    __wsTest: {
      emit: (msg: StalledMsg) => {
        handlers.get(msg.type)?.forEach((h) => h(msg))
      },
      reset: () => handlers.clear(),
    },
  }
})

const { __wsTest } = jest.requireMock('@/services/ws-client') as {
  __wsTest: { emit: (msg: StalledMsg) => void; reset: () => void }
}

beforeEach(() => {
  jest.useFakeTimers()
  __wsTest.reset()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('useStreamStalled', () => {
  it('flags a stall after 15s without a terminal frame', () => {
    const { result } = renderHook(() => useStreamStalled('srv-1', 'sess-1', true))
    expect(result.current).toBe(false)

    act(() => jest.advanceTimersByTime(STREAM_STALL_TIMEOUT_MS))
    expect(result.current).toBe(true)
  })

  it('a terminal frame for the session defers and clears the stall', () => {
    const { result } = renderHook(() => useStreamStalled('srv-1', 'sess-1', true))

    act(() => jest.advanceTimersByTime(10_000))
    act(() => __wsTest.emit({ type: 'terminal_output', sessionId: 'sess-1', data: 'x' }))
    act(() => jest.advanceTimersByTime(10_000))
    expect(result.current).toBe(false)

    // Stall fires 15s after the LAST frame…
    act(() => jest.advanceTimersByTime(5_000))
    expect(result.current).toBe(true)

    // …and clears immediately on the next frame.
    act(() => __wsTest.emit({ type: 'terminal_output', sessionId: 'sess-1', data: 'y' }))
    expect(result.current).toBe(false)
  })

  it('ignores frames for other sessions', () => {
    const { result } = renderHook(() => useStreamStalled('srv-1', 'sess-1', true))

    act(() => jest.advanceTimersByTime(10_000))
    act(() => __wsTest.emit({ type: 'terminal_output', sessionId: 'other', data: 'x' }))
    act(() => jest.advanceTimersByTime(5_000))
    expect(result.current).toBe(true)
  })

  it('stays false while disabled and resets when disabled after a stall', () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useStreamStalled('srv-1', 'sess-1', enabled),
      { initialProps: { enabled: true } },
    )

    act(() => jest.advanceTimersByTime(STREAM_STALL_TIMEOUT_MS))
    expect(result.current).toBe(true)

    rerender({ enabled: false })
    act(() => jest.runOnlyPendingTimers())
    expect(result.current).toBe(false)

    act(() => jest.advanceTimersByTime(STREAM_STALL_TIMEOUT_MS * 2))
    expect(result.current).toBe(false)
  })
})
