import { renderHook, waitFor } from '@testing-library/react-native'
import {
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

jest.mock('@/services/api-client', () => ({
  createApiForServer: (serverId: string) => ({
    get: (path: string) => {
      const h = handlers[serverId]
      if (!h) return Promise.reject(new Error(`no handler for ${serverId}`))
      return h(path)
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
  useServersStore.setState({ servers: {}, activeServerIds: [], displayedServerIds: [] } as any)
  useServerFetchStatusStore.setState({ statuses: {} })
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
