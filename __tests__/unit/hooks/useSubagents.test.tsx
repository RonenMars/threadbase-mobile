import { renderHook, waitFor } from '@testing-library/react-native'
import { useSubagents } from '@/hooks/useSubagents'
import { createWrapper } from '@/test-utils'

const mockGet = jest.fn()

jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({ get: (...a: unknown[]) => mockGet(...a) }),
}))

const child = (id: string, parent = 'p1', over: Record<string, unknown> = {}) => ({
  id,
  title: `t-${id}`,
  projectPath: '/p',
  messageCount: 2,
  lastActivity: '2026-10-24T10:00:00Z',
  isSubagent: true,
  parentConversationId: parent,
  ...over,
})

beforeEach(() => mockGet.mockReset())

describe('useSubagents', () => {
  it('does not request anything until enabled', () => {
    renderHook(() => useSubagents('s1', 'p1', { enabled: false }), { wrapper: createWrapper() })
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('requests ?parent= with limit 50 and returns the children, with or without the optional fields', async () => {
    mockGet.mockResolvedValue({
      conversations: [child('a', 'p1', { subagentActive: true, subagentType: 'Explore' }), child('b')],
      hasMore: false,
      offset: 0,
      total: 2,
    })
    const { result } = await renderHook(() => useSubagents('s1', 'p1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    expect(mockGet.mock.calls[0][0]).toBe('/api/conversations?parent=p1&limit=50&offset=0')
    expect(result.current.unsupported).toBe(false)
    expect(result.current.items[0].subagentType).toBe('Explore')
    expect(result.current.items[1].subagentType).toBeUndefined()
  })

  it('paginates by the number of rows already fetched', async () => {
    mockGet
      .mockResolvedValueOnce({ conversations: [child('a'), child('b')], hasMore: true, offset: 0, total: 3 })
      .mockResolvedValueOnce({ conversations: [child('c')], hasMore: false, offset: 2, total: 3 })
    const { result } = await renderHook(() => useSubagents('s1', 'p1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))
    await result.current.fetchNextPage()
    await waitFor(() => expect(result.current.items).toHaveLength(3))
    expect(mockGet.mock.calls[1][0]).toBe('/api/conversations?parent=p1&limit=50&offset=2')
  })

  it('reports unsupported and renders no rows when an older streamer ignores parent=', async () => {
    mockGet.mockResolvedValue({
      conversations: [
        { id: 'x', title: 'Unrelated', projectPath: '/p', messageCount: 1, lastActivity: '' },
        child('y', 'someone-else'),
      ],
      hasMore: true,
      offset: 0,
      total: 99,
    })
    const { result } = await renderHook(() => useSubagents('s1', 'p1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.unsupported).toBe(true))
    expect(result.current.items).toEqual([])
    expect(result.current.hasNextPage).toBe(false)
  })
})
