import { renderHook, waitFor } from '@testing-library/react-native'
import { useRecentSessions, usePopularProjects } from '@/hooks/useQuickAccess'
import { createWrapper } from '@/test-utils'

const mockGet = jest.fn()
jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({ get: mockGet }),
}))

beforeEach(() => { mockGet.mockReset() })

describe('useRecentSessions', () => {
  it('fetches from /api/sessions/recents', async () => {
    mockGet.mockResolvedValue({ sessions: [{ id: 's1', projectPath: '~/app' }], total: 1 })
    const { result } = renderHook(() => useRecentSessions('srv1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.sessions).toHaveLength(1)
    expect(mockGet).toHaveBeenCalledWith('/api/sessions/recents?limit=20')
  })
})

describe('usePopularProjects', () => {
  it('fetches from /api/projects/popular', async () => {
    mockGet.mockResolvedValue({ projects: [{ path: '~/app', name: 'app', sessionCount: 5 }], total: 1 })
    const { result } = renderHook(() => usePopularProjects('srv1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.projects[0].sessionCount).toBe(5)
    expect(mockGet).toHaveBeenCalledWith('/api/projects/popular?limit=20')
  })
})
