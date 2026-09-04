import type { NetInfoState } from '@react-native-community/netinfo'
import { onlineManager } from '@tanstack/react-query'
import { shouldPersistQuery, queryClient } from '@/services/query-client'
import { NotFoundError } from '@/services/api-client'
import { useLoadingStateStore } from '@/stores/loading-state'

// jest.mock is hoisted above imports and its factory runs during the
// query-client import (before any top-level const initializes), so the captured
// listener is stashed on the mock module itself and read back via require here.
jest.mock('@react-native-community/netinfo', () => {
  const holder: { listener?: (state: unknown) => void } = {}
  return {
    __esModule: true,
    default: {
      addEventListener: (cb: (state: unknown) => void) => {
        holder.listener = cb
        return jest.fn()
      },
    },
    __holder: holder,
  }
})

function emit(partial: Partial<NetInfoState>) {
  const mod = jest.requireMock('@react-native-community/netinfo') as {
    __holder: { listener?: (state: unknown) => void }
  }
  mod.__holder.listener?.(partial)
}

function q(queryKey: readonly unknown[], meta?: unknown) {
  return { queryKey, meta }
}

describe('shouldPersistQuery (persistence allow-list)', () => {
  it('allows session/conversation/project/serverInfo lightweight metadata', () => {
    expect(shouldPersistQuery(q(['session', 'srv1', 's1']))).toBe(true)
    expect(shouldPersistQuery(q(['conversation', 'srv1', 'c1']))).toBe(true)
    expect(shouldPersistQuery(q(['project', 'srv1', 'p1']))).toBe(true)
    expect(shouldPersistQuery(q(['serverInfo', 'srv1']))).toBe(true)
  })

  it('does NOT persist projectChats (removed)', () => {
    expect(shouldPersistQuery(q(['projectChats', 'srv1']))).toBe(false)
  })

  it('does NOT persist sessionMessages by default', () => {
    expect(shouldPersistQuery(q(['sessionMessages', 'srv1', 's1']))).toBe(false)
  })

  it('does NOT persist arbitrary unlisted query roots', () => {
    expect(shouldPersistQuery(q(['browse', 'srv1', '/some/path']))).toBe(false)
    expect(shouldPersistQuery(q(['random-thing']))).toBe(false)
  })

  it('respects an explicit meta.persist=false override on an allowed query', () => {
    expect(shouldPersistQuery(q(['session', 'srv1', 's1'], { persist: false }))).toBe(false)
  })
})

describe('onlineManager <- NetInfo wiring', () => {
  afterEach(() => {
    onlineManager.setOnline(true)
  })

  it('registers a NetInfo listener on module load', () => {
    const mod = jest.requireMock('@react-native-community/netinfo') as {
      __holder: { listener?: unknown }
    }
    expect(mod.__holder.listener).toBeDefined()
  })

  it('flips onlineManager offline when NetInfo reports no connection', () => {
    emit({ isConnected: false, isInternetReachable: false })
    expect(onlineManager.isOnline()).toBe(false)
  })

  it('flips onlineManager back online on reconnect', () => {
    emit({ isConnected: false, isInternetReachable: false })
    emit({ isConnected: true, isInternetReachable: true })
    expect(onlineManager.isOnline()).toBe(true)
  })

  it('treats unknown reachability (null) as online so cold start does not pause', () => {
    emit({ isConnected: true, isInternetReachable: null })
    expect(onlineManager.isOnline()).toBe(true)
  })

  it('resumes paused mutations on an offline->online transition', () => {
    const resume = jest.spyOn(queryClient, 'resumePausedMutations').mockResolvedValue(undefined)
    emit({ isConnected: false, isInternetReachable: false })
    emit({ isConnected: true, isInternetReachable: true })
    expect(resume).toHaveBeenCalledTimes(1)
    resume.mockRestore()
  })

  it('does NOT resume when staying online (no transition)', () => {
    onlineManager.setOnline(true)
    const resume = jest.spyOn(queryClient, 'resumePausedMutations').mockResolvedValue(undefined)
    emit({ isConnected: true, isInternetReachable: true })
    expect(resume).not.toHaveBeenCalled()
    resume.mockRestore()
  })
})

describe('slow-query overlay (dangling slow-count)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    useLoadingStateStore.setState({
      slowCounts: { sessions: 0, conversations: 0, messages: 0, 'session-detail': 0, browse: 0, other: 0 },
    })
  })
  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    queryClient.clear()
  })

  it('decrements the slow-count even when the query is removed mid-fetch', async () => {
    // A never-resolving fetch keeps the query in fetchStatus 'fetching'.
    let cancelled = false
    const p = queryClient.fetchQuery({
      queryKey: ['sessions', 'srv1'],
      queryFn: () => new Promise(() => { /* never resolves */ }),
    })
    p.catch(() => { cancelled = true })

    // Cross the 60s slow threshold → incrementSlow('sessions').
    jest.advanceTimersByTime(60000)
    expect(useLoadingStateStore.getState().slowCounts.sessions).toBe(1)

    // Remove the query while it is still fetching — previously the settle event
    // never fired for this hash, leaving the count dangling at 1 forever.
    queryClient.removeQueries({ queryKey: ['sessions', 'srv1'] })
    expect(useLoadingStateStore.getState().slowCounts.sessions).toBe(0)
    void cancelled
  })
})


describe('error banner opt-out (meta.silentError)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    useLoadingStateStore.setState({ errors: [] })
  })
  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    queryClient.clear()
  })

  async function failWith(queryKey: readonly unknown[], meta?: Record<string, unknown>) {
    await queryClient
      .fetchQuery({
        queryKey,
        queryFn: () => Promise.reject(new NotFoundError('/api/sessions/abc')),
        retry: false,
        meta,
      })
      .catch(() => {})
    // pushError is deferred a tick so it never runs inside the cache subscriber.
    jest.advanceTimersByTime(0)
  }

  it('pushes a banner row for an ordinary failing query — the control', async () => {
    await failWith(['session', 'srv1', 'ordinary'])
    expect(useLoadingStateStore.getState().errors).toHaveLength(1)
    expect(useLoadingStateStore.getState().errors[0].category).toBe('session-detail')
  })

  it('pushes no row when the query opts out', async () => {
    // The conversation screen's not-found fallback asks /api/sessions/<id> with a
    // CONVERSATION id: it 404s by construction for anything that was never a
    // session, and every conversation 404 therefore grew a phantom second row.
    await failWith(['session', 'srv1', 'probe'], { persist: false, silentError: true })
    expect(useLoadingStateStore.getState().errors).toHaveLength(0)
  })

  it('carries the 404 status through to the row, so it can be classified', async () => {
    await failWith(['session', 'srv1', 'statused'])
    const [row] = useLoadingStateStore.getState().errors
    expect(row.status).toBe(404)
    expect(row.code).toBe('HTTP_404')
  })
})
