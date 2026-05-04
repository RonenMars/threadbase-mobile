import { renderHook, waitFor, act } from '@testing-library/react-native'
import { useEagerSessions } from '@/hooks/useSession'
import { useServersStore } from '@/stores/servers'
import { createWrapper } from '@/test-utils'
import type { Session, SessionListPage } from '@/types/api'

const mockGet = jest.fn()

jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({ get: (path: string) => mockGet(path) }),
}))

function makeSession(id: string): Session {
  return {
    id,
    status: 'idle',
    ptyAttached: false,
    projectPath: '/tmp/p',
    projectName: `proj-${id}`,
    branch: 'main',
    lastOutput: '',
    elapsedMs: 0,
    promptCount: 0,
    startedAt: '2026-04-18T10:00:00.000Z',
  }
}

function pageOf(ids: string[], opts: { nextCursor?: string | null; total?: number } = {}): SessionListPage {
  return {
    sessions: ids.map(makeSession),
    nextCursor: opts.nextCursor ?? null,
    total: opts.total ?? ids.length,
  }
}

function setActiveServers(serverDefs: { id: string; label?: string }[]) {
  // Build a minimal servers map; the hook only reads `servers[serverId]?.label`
  // and `activeServerIds`, so we can fill in the rest with stubs.
  const servers: Record<string, any> = {}
  for (const def of serverDefs) {
    servers[def.id] = {
      id: def.id,
      url: 'http://stub',
      apiKey: 'k',
      label: def.label,
      isConnected: true,
      serverInfo: null,
      connectionError: null,
    }
  }
  useServersStore.setState({
    servers,
    activeServerIds: serverDefs.map((s) => s.id),
    displayedServerIds: serverDefs.map((s) => s.id),
  } as any)
}

beforeEach(() => {
  mockGet.mockReset()
  useServersStore.setState({
    servers: {},
    activeServerIds: [],
    displayedServerIds: [],
  } as any)
})

describe('useEagerSessions', () => {
  it('drains a single server across multiple pages', async () => {
    setActiveServers([{ id: 'srv-A', label: 'Server A' }])

    // Three pages of 2 items each, total = 6.
    mockGet
      .mockResolvedValueOnce(pageOf(['a1', 'a2'], { nextCursor: 'c1', total: 6 }))
      .mockResolvedValueOnce(pageOf(['a3', 'a4'], { nextCursor: 'c2', total: 6 }))
      .mockResolvedValueOnce(pageOf(['a5', 'a6'], { nextCursor: null, total: 6 }))

    const { result } = renderHook(() => useEagerSessions(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isDone).toBe(true))

    expect(result.current.sessions.map((s) => s.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6'])
    expect(result.current.loaded).toBe(6)
    expect(result.current.total).toBe(6)
    expect(mockGet).toHaveBeenCalledTimes(3)

    // Each page request carries the wire sort key + order.
    const firstCall = mockGet.mock.calls[0][0] as string
    expect(firstCall).toContain('sortBy=lastActivityAt')
    expect(firstCall).toContain('order=desc')
    expect(firstCall).toContain('limit=200')
    expect(firstCall).not.toContain('cursor=')

    const secondCall = mockGet.mock.calls[1][0] as string
    expect(secondCall).toContain('cursor=c1')
  })

  it('processes servers sequentially and surfaces the current server label', async () => {
    setActiveServers([
      { id: 'srv-A', label: 'Alpha' },
      { id: 'srv-B', label: 'Beta' },
    ])

    // Server A: 1 page, 2 items, total 2.
    // Server B: 1 page, 1 item, total 1.
    // We capture progress mid-flight by having the first fetch's promise be
    // resolvable on demand.
    let resolveA: (v: SessionListPage) => void = () => {}
    const aPromise = new Promise<SessionListPage>((res) => {
      resolveA = res
    })
    mockGet
      .mockReturnValueOnce(aPromise)
      .mockResolvedValueOnce(pageOf(['b1'], { nextCursor: null, total: 1 }))

    const { result } = renderHook(() => useEagerSessions(), { wrapper: createWrapper() })

    // While A is in-flight we should be on the Alpha label, with total=0
    // (haven't seen the first page yet) and not done.
    await waitFor(() => expect(result.current.currentServerLabel).toBe('Alpha'))
    expect(result.current.isDone).toBe(false)
    expect(result.current.total).toBe(0)

    // Resolve A.
    await act(async () => {
      resolveA(pageOf(['a1', 'a2'], { nextCursor: null, total: 2 }))
    })

    await waitFor(() => expect(result.current.isDone).toBe(true))

    expect(result.current.sessions.map((s) => s.id)).toEqual(['a1', 'a2', 'b1'])
    expect(result.current.loaded).toBe(3)
    // Total reflects Alpha (2) + Beta (1).
    expect(result.current.total).toBe(3)
  })

  it('passes status filter on the wire', async () => {
    setActiveServers([{ id: 'srv-A', label: 'A' }])
    mockGet.mockResolvedValueOnce(pageOf([], { nextCursor: null, total: 0 }))

    const { result } = renderHook(
      () => useEagerSessions({ filter: { status: ['running', 'waiting_input'] } }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isDone).toBe(true))
    const url = mockGet.mock.calls[0][0] as string
    expect(url).toContain('status=running%2Cwaiting_input')
  })

  it('reports error when a fetch fails mid-loop and exits the loading state', async () => {
    setActiveServers([{ id: 'srv-A', label: 'A' }])
    mockGet.mockRejectedValueOnce(new Error('boom'))

    const { result } = renderHook(() => useEagerSessions(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isDone).toBe(true))
    expect(result.current.error).toBeTruthy()
    expect(result.current.error?.message).toBe('boom')
    expect(result.current.sessions).toEqual([])
  })

  it('changing sort triggers a fresh sequential loop', async () => {
    setActiveServers([{ id: 'srv-A', label: 'A' }])
    mockGet
      .mockResolvedValueOnce(pageOf(['a1'], { nextCursor: null, total: 1 }))
      .mockResolvedValueOnce(pageOf(['a1'], { nextCursor: null, total: 1 }))

    const { result, rerender } = renderHook(
      ({ sortBy }: { sortBy: 'lastActivity' | 'projectName' }) =>
        useEagerSessions({ sort: { sortBy, order: 'desc' } }),
      { wrapper: createWrapper(), initialProps: { sortBy: 'lastActivity' } },
    )

    await waitFor(() => expect(result.current.isDone).toBe(true))
    expect(mockGet).toHaveBeenCalledTimes(1)

    rerender({ sortBy: 'projectName' })

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    const secondCall = mockGet.mock.calls[1][0] as string
    expect(secondCall).toContain('sortBy=projectName')
  })
})
