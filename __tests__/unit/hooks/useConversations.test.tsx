import { renderHook, waitFor } from '@testing-library/react-native'
import {
  useConversation,
  useConversations,
  useConversationSearch,
  useEagerConversations,
} from '@/hooks/useConversations'
import { useServersStore } from '@/stores/servers'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { createWrapper } from '@/test-utils'

// Inline the raw snake_case shape — it's private to useConversations.ts and we
// don't want to export it just for tests.
interface RawSessionMeta {
  id: string
  project_name?: string
  project_path?: string
  last_updated_at?: string
  message_count?: number
}

// Bug 32: one failing server must not hide conversations from healthy servers.
// We mock createApiForServer so each serverId can independently resolve/reject.

const handlers: Record<string, (path: string) => Promise<unknown>> = {}
// Records the last If-None-Match header each server's getWithMeta saw, plus a
// per-server responder for the conditional first-page fetch.
const metaHandlers: Record<
  string,
  (path: string, opts?: { headers?: Record<string, string> }) => Promise<unknown>
> = {}

jest.mock('@/services/api-client', () => ({
  createApiForServer: (serverId: string) => ({
    get: (path: string) => {
      const h = handlers[serverId]
      if (!h) return Promise.reject(new Error(`no handler for ${serverId}`))
      return h(path)
    },
    getWithMeta: (path: string, opts?: { headers?: Record<string, string> }) => {
      const h = metaHandlers[serverId]
      if (!h) return Promise.reject(new Error(`no meta handler for ${serverId}`))
      return h(path, opts)
    },
  }),
}))

function rawSession(id: string, projectName = `proj-${id}`): RawSessionMeta {
  return {
    id,
    project_name: projectName,
    project_path: '/tmp/p',
    last_updated_at: '2026-04-18T10:00:00.000Z',
    message_count: 1,
  }
}

function setActiveServers(ids: string[]) {
  const servers: Record<string, any> = {}
  for (const id of ids) {
    servers[id] = {
      id,
      url: 'http://stub',
      apiKey: 'k',
      label: id.toUpperCase(),
      isConnected: true,
      serverInfo: null,
      connectionError: null,
    }
  }
  useServersStore.setState({
    servers,
    activeServerIds: ids,
    displayedServerIds: ids,
  } as any)
}

beforeEach(() => {
  for (const k of Object.keys(handlers)) delete handlers[k]
  for (const k of Object.keys(metaHandlers)) delete metaHandlers[k]
  useServersStore.setState({ servers: {}, activeServerIds: [], displayedServerIds: [] } as any)
  useServerFetchStatusStore.setState({ statuses: {} })
})

function rawConversationPage(id: string, texts: string[]) {
  return {
    meta: { id, project_name: `proj-${id}`, message_count: texts.length },
    messages: texts.map((text, i) => ({ message_index: i, role: 'user', content: [{ type: 'text', text }], timestamp: '2026-06-11T10:00:00.000Z' })),
    message_pagination: { total: texts.length, before_index: texts.length, from_index: 0, has_more_older: false, next_before_index: null },
  }
}

describe('useConversation — ETag conditional fetch (Task C)', () => {
  it('fetches the first page via getWithMeta and renders messages', async () => {
    setActiveServers(['srv_a'])
    let lastIfNoneMatch: string | undefined
    metaHandlers.srv_a = (_path, opts) => {
      lastIfNoneMatch = opts?.headers?.['If-None-Match']
      return Promise.resolve({ status: 200, etag: '"v1"', body: rawConversationPage('c1', ['hello']) })
    }

    const { result } = renderHook(() => useConversation('srv_a', 'c1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data?.messages.length).toBe(1)
    // First-ever fetch has no stored ETag, so no If-None-Match is sent.
    expect(lastIfNoneMatch).toBeUndefined()
  })

  it('degrades gracefully when the server emits no ETag (status 200, etag null)', async () => {
    setActiveServers(['srv_b'])
    metaHandlers.srv_b = () =>
      Promise.resolve({ status: 200, etag: null, body: rawConversationPage('c2', ['a', 'b']) })

    const { result } = renderHook(() => useConversation('srv_b', 'c2'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data?.messages.length).toBe(2)
  })

  it('parses resumable + unavailable_reason from the meta', async () => {
    setActiveServers(['srv_c'])
    const page = rawConversationPage('c3', ['hi'])
    page.meta = { ...page.meta, resumable: false, unavailable_reason: 'worktree_removed' } as any
    metaHandlers.srv_c = () => Promise.resolve({ status: 200, etag: '"v1"', body: page })

    const { result } = renderHook(() => useConversation('srv_c', 'c3'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data?.resumable).toBe(false)
    expect(result.current.data?.unavailableReason).toBe('worktree_removed')
  })

  it('leaves resumable undefined for older servers that omit it (back-compat)', async () => {
    setActiveServers(['srv_d'])
    metaHandlers.srv_d = () =>
      Promise.resolve({ status: 200, etag: '"v1"', body: rawConversationPage('c4', ['hi']) })

    const { result } = renderHook(() => useConversation('srv_d', 'c4'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data?.resumable).toBeUndefined()
    expect(result.current.data?.unavailableReason).toBeUndefined()
  })
})

describe('useConversations — partial failure (Bug 32)', () => {
  it('returns conversations from healthy server when other server fails', async () => {
    setActiveServers(['srv-A', 'srv-B'])

    handlers['srv-A'] = () =>
      Promise.resolve([rawSession('a1'), rawSession('a2')]) as Promise<unknown>
    handlers['srv-B'] = () => Promise.reject(new Error('boom'))

    const { result } = renderHook(() => useConversations(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.data?.pages.length).toBe(1))

    const ids = result.current.data!.pages[0].conversations.map((c) => c.id)
    expect(ids).toEqual(expect.arrayContaining(['a1', 'a2']))
    expect(ids).toHaveLength(2)
    expect(result.current.isError).toBe(false)
  })

  it('records the failing server in the fetch-status store', async () => {
    setActiveServers(['srv-A', 'srv-B'])

    handlers['srv-A'] = () => Promise.resolve([rawSession('a1')]) as Promise<unknown>
    handlers['srv-B'] = () => Promise.reject(new Error('host unreachable'))

    const { result } = renderHook(() => useConversations(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())

    const statuses = useServerFetchStatusStore.getState().statuses
    expect(statuses['srv-A']?.status).toBe('ok')
    expect(statuses['srv-B']?.status).toBe('error')
    expect(statuses['srv-B']?.error).toContain('host unreachable')
  })

  it('single failing server still surfaces as a query error', async () => {
    setActiveServers(['srv-A'])
    handlers['srv-A'] = () => Promise.reject(new Error('down'))

    const { result } = renderHook(() => useConversations(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })
})

describe('useConversationSearch — partial failure (Bug 32)', () => {
  it('returns matches from healthy server when other server fails', async () => {
    setActiveServers(['srv-A', 'srv-B'])

    handlers['srv-A'] = () => Promise.resolve([rawSession('a1', 'alpha')]) as Promise<unknown>
    handlers['srv-B'] = () => Promise.reject(new Error('5xx'))

    const { result } = renderHook(() => useConversationSearch('alpha'), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data!.conversations.map((c) => c.id)).toEqual(['a1'])
    expect(result.current.isError).toBe(false)
  })
})

describe('useEagerConversations — partial failure (Bug 32)', () => {
  it('continues to next server when one server fails', async () => {
    setActiveServers(['srv-A', 'srv-B'])

    // Server A fails on count.
    handlers['srv-A'] = (path: string) => {
      if (path.includes('/api/conversations/count')) {
        return Promise.reject(new Error('A is down'))
      }
      return Promise.resolve([]) as Promise<unknown>
    }
    // Server B succeeds: count=1, one page with one conversation.
    handlers['srv-B'] = (path: string) => {
      if (path.includes('/api/conversations/count')) {
        return Promise.resolve({ total: 1 }) as Promise<unknown>
      }
      return Promise.resolve([rawSession('b1')]) as Promise<unknown>
    }

    const { result } = renderHook(() => useEagerConversations(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isDone).toBe(true))

    expect(result.current.conversations.map((c) => c.id)).toEqual(['b1'])

    const statuses = useServerFetchStatusStore.getState().statuses
    expect(statuses['srv-A']?.status).toBe('error')
    expect(statuses['srv-B']?.status).toBe('ok')
  })
})
