import { renderHook, waitFor } from '@testing-library/react-native'
import { useRecentSessions, usePopularProjects } from '@/hooks/useQuickAccess'
import { createWrapper } from '@/test-utils'

const mockGet = jest.fn()
jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({ get: mockGet }),
}))

beforeEach(() => { mockGet.mockReset() })

describe('useRecentSessions', () => {
  it('fetches from /project-chats and tags items with serverId', async () => {
    mockGet.mockResolvedValue({ items: [{ id: 's1', projectId: 'p1', title: '~/app', type: 'session' }] })
    const { result } = renderHook(() => useRecentSessions(['srv1']), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data.projectChats).toHaveLength(1)
    expect(result.current.data.projectChats[0]).toMatchObject({ id: 's1', serverId: 'srv1' })
    expect(mockGet).toHaveBeenCalledWith('/project-chats?limit=20')
  })

  it('unions project-chats across multiple servers, newest first', async () => {
    mockGet
      .mockResolvedValueOnce({ items: [{ id: 's1', projectId: 'p1', title: 'a', type: 'session', latestMessageAt: '2026-05-16T10:00:00Z' }] })
      .mockResolvedValueOnce({ items: [{ id: 's2', projectId: 'p2', title: 'b', type: 'session', latestMessageAt: '2026-05-16T11:00:00Z' }] })
    const { result } = renderHook(
      () => useRecentSessions(['srvA', 'srvB']),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.data.projectChats).toHaveLength(2))
    // Newest first by latestMessageAt: srvB's s2 comes before srvA's s1
    expect(result.current.data.projectChats[0].id).toBe('s2')
    expect(result.current.data.projectChats[1].id).toBe('s1')
  })
})

describe('usePopularProjects', () => {
  it('fetches from /api/projects/popular and tags projects with serverId', async () => {
    mockGet.mockResolvedValue({ projects: [{ path: '~/app', name: 'app', sessionCount: 5 }], total: 1 })
    const { result } = renderHook(() => usePopularProjects(['srv1']), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data.projects[0]).toMatchObject({ sessionCount: 5, serverId: 'srv1' })
    expect(mockGet).toHaveBeenCalledWith('/api/projects/popular?limit=20')
  })

  it('dedups by path keeping highest sessionCount across servers — and preserves its serverId (Bug 23)', async () => {
    mockGet
      .mockResolvedValueOnce({ projects: [{ path: '~/app', name: 'app', sessionCount: 3 }], total: 1 })
      .mockResolvedValueOnce({ projects: [{ path: '~/app', name: 'app', sessionCount: 7 }], total: 1 })
    const { result } = renderHook(
      () => usePopularProjects(['srvA', 'srvB']),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.data.projects).toHaveLength(1))
    expect(result.current.data.projects[0]).toMatchObject({ sessionCount: 7, serverId: 'srvB' })
  })
})
