import { renderHook, waitFor, act } from '@testing-library/react-native'
import { useEagerSessions } from '@/hooks/useSession'
import { deriveSessionPresentation } from '@/lib/sessionPresentation'
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
    subStatus: null,
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

    const { result } = await renderHook(() => useEagerSessions(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isDone).toBe(true))

    expect(result.current.sessions.map((s) => s.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6'])
    expect(result.current.loaded).toBe(6)
    expect(result.current.total).toBe(6)
    expect(mockGet).toHaveBeenCalledTimes(3)

    // Each page request carries the wire sort key + order.
    const firstCall = mockGet.mock.calls[0][0] as string
    expect(firstCall).toContain('sortBy=lastActivityAt')
    expect(firstCall).toContain('order=desc')
    expect(firstCall).toContain('limit=50')
    expect(firstCall).not.toContain('cursor=')

    const secondCall = mockGet.mock.calls[1][0] as string
    expect(secondCall).toContain('cursor=c1')
  })

  it('fetches servers in parallel and aggregates progress', async () => {
    setActiveServers([
      { id: 'srv-A', label: 'Alpha' },
      { id: 'srv-B', label: 'Beta' },
    ])

    // Server A: 1 page, 2 items. Server B: 1 page, 1 item.
    // Both are kicked off simultaneously; stagger resolution to observe
    // intermediate aggregate state.
    let resolveA: (v: SessionListPage) => void = () => {}
    const aPromise = new Promise<SessionListPage>((res) => { resolveA = res })

    // First call → Server A (in-flight), second call → Server B (resolves fast).
    mockGet
      .mockReturnValueOnce(aPromise)
      .mockResolvedValueOnce(pageOf(['b1'], { nextCursor: null, total: 1 }))

    const { result } = await renderHook(() => useEagerSessions(), { wrapper: createWrapper() })

    // Before A resolves: both servers in-flight, B may already have landed.
    // inFlightCount starts at 2 and drops as each server finishes.
    await waitFor(() => expect(result.current.inFlightCount).toBeLessThanOrEqual(2))
    expect(result.current.isDone).toBe(false)

    // Resolve A — now both servers are done.
    await act(async () => {
      resolveA(pageOf(['a1', 'a2'], { nextCursor: null, total: 2 }))
    })

    await waitFor(() => expect(result.current.isDone).toBe(true))

    expect(result.current.sessions.map((s) => s.id).sort()).toEqual(['a1', 'a2', 'b1'].sort())
    expect(result.current.loaded).toBe(3)
    // Total = Alpha (2) + Beta (1).
    expect(result.current.total).toBe(3)
    expect(result.current.inFlightCount).toBe(0)
  })

  it('passes status filter on the wire', async () => {
    setActiveServers([{ id: 'srv-A', label: 'A' }])
    mockGet.mockResolvedValueOnce(pageOf([], { nextCursor: null, total: 0 }))

    const { result } = await renderHook(
      () => useEagerSessions({ filter: { status: ['running', 'waiting_input'] } }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isDone).toBe(true))
    const url = mockGet.mock.calls[0][0] as string
    expect(url).toContain('status=running%2Cwaiting_input')
  })

  it('isolates per-server fetch errors and returns sessions from healthy servers', async () => {
    setActiveServers([
      { id: 'srv-A', label: 'A' },
      { id: 'srv-B', label: 'B' },
    ])
    // Server A fails; Server B succeeds.
    mockGet
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(pageOf(['b1'], { nextCursor: null, total: 1 }))

    const { result } = await renderHook(() => useEagerSessions(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isDone).toBe(true))
    // The query itself succeeds — partial results are not a fatal error.
    expect(result.current.error).toBeNull()
    // Only sessions from the healthy server are present.
    expect(result.current.sessions.map((s) => s.id)).toEqual(['b1'])
  })

  // The streamer ships wire changes without gating on this build (CLAUDE.md →
  // "Server contract — degrade, don't break"), so a status this build has never
  // heard of has to land as a renderable row, not as a crash or a blank screen.
  it('degrades a session carrying an unknown status, missing optionals and no capability fields', async () => {
    setActiveServers([{ id: 'srv-A', label: 'A' }])

    const aheadOfBuild = {
      id: 'a1',
      // Unknown to this build's SessionStatus union.
      status: 'archiving',
      ptyAttached: false,
      projectPath: '/tmp/p',
      projectName: 'proj-a1',
      lastOutput: '',
      elapsedMs: 0,
      promptCount: 0,
      startedAt: '2026-08-14T10:00:00.000Z',
      // No branch/provider (missing optionals) and no lifecycle/ownership/
      // processLiveness (capabilities this server does not report).
    }
    mockGet.mockResolvedValueOnce({ sessions: [aheadOfBuild], nextCursor: null, total: 1 })

    const { result } = await renderHook(() => useEagerSessions(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isDone).toBe(true))

    expect(result.current.error).toBeNull()
    const [session] = result.current.sessions
    expect(session?.id).toBe('a1')
    // Narrowed to the safe fallback rather than passed through as-is.
    expect(session?.status).toBe('idle')
    // And the row still derives a renderable presentation.
    expect(() => deriveSessionPresentation(session)).not.toThrow()
  })

  it('changing sort triggers a fresh parallel fetch', async () => {
    setActiveServers([{ id: 'srv-A', label: 'A' }])
    mockGet
      .mockResolvedValueOnce(pageOf(['a1'], { nextCursor: null, total: 1 }))
      .mockResolvedValueOnce(pageOf(['a1'], { nextCursor: null, total: 1 }))

    const { result, rerender } = await renderHook(
      ({ sortBy }: { sortBy: 'lastActivity' | 'projectName' }) =>
        useEagerSessions({ sort: { sortBy, order: 'desc' } }),
      { wrapper: createWrapper(), initialProps: { sortBy: 'lastActivity' } },
    )

    await waitFor(() => expect(result.current.isDone).toBe(true))
    expect(mockGet).toHaveBeenCalledTimes(1)

    await rerender({ sortBy: 'projectName' })

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    const secondCall = mockGet.mock.calls[1][0] as string
    expect(secondCall).toContain('sortBy=projectName')
  })
})
