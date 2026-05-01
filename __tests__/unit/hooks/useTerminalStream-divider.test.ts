import { renderHook, act } from '@testing-library/react-native'
import { useTerminalStream } from '@/hooks/useTerminalStream'

// Minimal mocks — the hook imports these at module level
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isPending: false }),
}))

jest.mock('@/services/ws-client', () => ({
  wsManager: {
    getClient: () => null,
    onAnyStatusChange: () => () => {},
  },
}))

jest.mock('@/stores/settings', () => ({
  useSettingsStore: (sel: (s: { terminalMaxLines: number }) => unknown) =>
    sel({ terminalMaxLines: 5000 }),
}))

jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({ get: async () => ({ output: '' }) }),
  NotFoundError: class NotFoundError extends Error {},
}))

describe('useTerminalStream – recordSentInput', () => {
  it('exposes recordSentInput function', () => {
    const { result } = renderHook(() =>
      useTerminalStream('server1', 'session1', true)
    )
    expect(typeof result.current.recordSentInput).toBe('function')
  })

  it('does not immediately inject a divider when recordSentInput is called', () => {
    const { result } = renderHook(() =>
      useTerminalStream('server1', 'session1', true)
    )
    act(() => {
      result.current.recordSentInput('run the tests')
    })
    // divider should not appear yet — waiting for idle flush
    const hasDivider = result.current.lines.some(
      (l) => typeof l !== 'string' && (l as { __divider: boolean }).__divider
    )
    expect(hasDivider).toBe(false)
  })
})
