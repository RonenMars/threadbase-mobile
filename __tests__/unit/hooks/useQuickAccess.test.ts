import { renderHook, waitFor } from '@testing-library/react-native'
import { useRecentSessions, usePopularProjects } from '@/hooks/useQuickAccess'
import { createWrapper } from '@/test-utils'

const mockGet = jest.fn()
jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({ get: mockGet }),
}))

beforeEach(() => { mockGet.mockReset() })

describe('useRecentSessions', () => {
  it('fetches from /api/sessions/recents and tags sessions with serverId', async () => {
    mockGet.mockResolvedValue({ sessions: [{ id: 's1', projectPath: '~/app' }], total: 1 })
    const { result } = renderHook(() => useRecentSessions(['srv1']), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data.sessions).toHaveLength(1)
    expect(result.current.data.sessions[0]).toMatchObject({ id: 's1', serverId: 'srv1' })
    expect(mockGet).toHaveBeenCalledWith('/api/sessions/recents?limit=20')
  })

  it('unions sessions across multiple servers', async () => {
    mockGet
      .mockResolvedValueOnce({ sessions: [{ id: 's1', startedAt: '2026-05-16T10:00:00Z' }], total: 1 })
      .mockResolvedValueOnce({ sessions: [{ id: 's2', startedAt: '2026-05-16T11:00:00Z' }], total: 1 })
    const { result } = renderHook(
      () => useRecentSessions(['srvA', 'srvB']),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.data.sessions).toHaveLength(2))
    // Newest first: srvB's s2 comes before srvA's s1
    expect(result.current.data.sessions[0].id).toBe('s2')
    expect(result.current.data.sessions[1].id).toBe('s1')
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
