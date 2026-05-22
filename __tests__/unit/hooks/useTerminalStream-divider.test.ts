import { renderHook, act } from '@testing-library/react-native'
import { useTerminalStream } from '@/hooks/useTerminalStream'

// ── ws-client mock ──────────────────────────────────────────────────────────
type MsgHandler = (msg: unknown) => void

let capturedOutputHandler: MsgHandler | null = null
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- captured by mock for parity; read in sibling tests
let capturedStatusHandler: ((sid: string, status: string) => void) | null = null

jest.mock('@/services/ws-client', () => ({
  wsManager: {
    getClient: () => ({
      send: () => {},
      on: (event: string, cb: MsgHandler) => {
        if (event === 'terminal_output') capturedOutputHandler = cb
        return () => {}
      },
    }),
    onAnyStatusChange: (cb: (sid: string, status: string) => void) => {
      capturedStatusHandler = cb
      return () => {}
    },
  },
}))

// ── other mocks ─────────────────────────────────────────────────────────────
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isPending: false }),
}))

jest.mock('@/stores/settings', () => ({
  useSettingsStore: (sel: (s: { terminalMaxLines: number }) => unknown) =>
    sel({ terminalMaxLines: 5000 }),
}))

jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({ get: async () => ({ output: '' }) }),
  NotFoundError: class NotFoundError extends Error {},
}))

// ── helpers ──────────────────────────────────────────────────────────────────
function fireOutput(sessionId: string, data: string) {
  capturedOutputHandler?.({ type: 'terminal_output', sessionId, data })
}

// ── tests ────────────────────────────────────────────────────────────────────
beforeEach(() => {
  capturedOutputHandler = null
  capturedStatusHandler = null
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('useTerminalStream – recordSentInput', () => {
  it('exposes recordSentInput function', () => {
    const { result } = renderHook(() =>
      useTerminalStream('server1', 'session1', false)
    )
    expect(typeof result.current.recordSentInput).toBe('function')
  })

  it('does not immediately inject a divider when recordSentInput is called', () => {
    const { result } = renderHook(() =>
      useTerminalStream('server1', 'session1', false)
    )
    act(() => {
      result.current.recordSentInput('run the tests')
    })
    const hasDivider = result.current.lines.some(
      (l) => typeof l !== 'string' && (l as { __divider: boolean }).__divider
    )
    expect(hasDivider).toBe(false)
  })

  it('flushes divider at stream-start when pending before first output', () => {
    const { result } = renderHook(() =>
      useTerminalStream('server1', 'session1', false)
    )

    act(() => {
      result.current.recordSentInput('run the tests')
    })

    // Trigger first terminal output — should flush divider before VT lines
    act(() => {
      fireOutput('session1', 'hello from claude\n')
    })

    const dividers = result.current.lines.filter(
      (l) => typeof l !== 'string' && (l as { __divider: boolean }).__divider
    )
    expect(dividers).toHaveLength(1)
    expect((dividers[0] as { __divider: true; text: string }).text).toBe('run the tests')
  })

  it('flushes divider after idle timer fires (1500ms) when stream goes quiet', () => {
    const { result } = renderHook(() =>
      useTerminalStream('server1', 'session1', false)
    )

    // Simulate an active stream first
    act(() => {
      fireOutput('session1', 'line one\n')
    })

    act(() => {
      result.current.recordSentInput('next command')
    })

    // Advance past idle threshold
    act(() => {
      jest.advanceTimersByTime(1600)
    })

    const dividers = result.current.lines.filter(
      (l) => typeof l !== 'string' && (l as { __divider: boolean }).__divider
    )
    expect(dividers).toHaveLength(1)
    expect((dividers[0] as { __divider: true; text: string }).text).toBe('next command')
  })
})
