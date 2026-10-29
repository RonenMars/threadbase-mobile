import { renderHook, waitFor } from '@testing-library/react-native'
import { useAllSubagents } from '@/hooks/useAllSubagents'
import { createWrapper } from '@/test-utils'

const mockGet = jest.fn()

jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({ get: (...a: unknown[]) => mockGet(...a) }),
}))

const child = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: `t-${id}`,
  projectPath: '/p',
  messageCount: 2,
  lastActivity: '2026-10-24T10:00:00Z',
  isSubagent: true,
  parentConversationId: 'p1',
  ...over,
})

beforeEach(() => {
  mockGet.mockReset()
  jest.useFakeTimers()
})
afterEach(() => jest.useRealTimers())

describe('useAllSubagents polling', () => {
  it('refetches every 5s while a row is active and stops once none is', async () => {
    mockGet
      .mockResolvedValueOnce({ conversations: [child('a', { subagentActive: true })] })
      .mockResolvedValueOnce({ conversations: [child('a', { subagentActive: false })] })
    const { result } = await renderHook(() => useAllSubagents(['s1']), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    expect(mockGet).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(5000)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    await jest.advanceTimersByTimeAsync(20000)
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  it('does not poll when no row is active', async () => {
    mockGet.mockResolvedValue({ conversations: [child('a')] })
    const { result } = await renderHook(() => useAllSubagents(['s1']), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    await jest.advanceTimersByTimeAsync(20000)
    expect(mockGet).toHaveBeenCalledTimes(1)
  })
})
