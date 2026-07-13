import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react-native'
import React from 'react'
import {
  useConversation,
  useConversations,
  useConversationSearch,
  useEagerConversations,
} from '@/hooks/useConversations'
import { useServersStore } from '@/stores/servers'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { createWrapper } from '@/test-utils'

// createWrapper hides its QueryClient; retention tests need to read gcTime
// back off the cache, so this variant exposes the client alongside the wrapper.
function wrapperWithClient() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, wrapper }
}

// Captures the scan_progress handler registered by useEagerConversations so
// tests can simulate a broadcast arriving mid-count.
let scanProgressHandler: ((msg: { type: string; serverId: string; scanned: number; total: number }) => void) | null = null

jest.mock('@/services/ws-client', () => ({
  wsManager: {
    onAll: (type: string, handler: (msg: any) => void) => {
      if (type === 'scan_progress') scanProgressHandler = handler
      return () => {
        if (type === 'scan_progress') scanProgressHandler = null
      }
    },
  },
}))

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

// Builds an anchored-window fixture: `count` messages starting at `fromIndex`,
// out of `total` overall. Pagination fields mirror what the streamer emits
// for msg_limit + anchor_index (or after_index).
function rawAnchoredPage(
  id: string,
  fromIndex: number,
  count: number,
  total: number,
  extra: Record<string, unknown> = {},
) {
  return {
    meta: { id, project_name: `proj-${id}`, message_count: total },
    messages: Array.from({ length: count }, (_, i) => ({
      message_index: fromIndex + i,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: [{ type: 'text', text: `msg ${fromIndex + i}` }],
      timestamp: '2026-06-11T10:00:00.000Z',
    })),
    message_pagination: {
      total,
      before_index: fromIndex + count,
      from_index: fromIndex,
      has_more_older: fromIndex > 0,
      next_before_index: fromIndex > 0 ? fromIndex : null,
      ...extra,
    },
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

    const { result } = await renderHook(() => useConversation('srv_a', 'c1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data?.messages.length).toBe(1)
    // First-ever fetch has no stored ETag, so no If-None-Match is sent.
    expect(lastIfNoneMatch).toBeUndefined()
  })

  it('degrades gracefully when the server emits no ETag (status 200, etag null)', async () => {
    setActiveServers(['srv_b'])
    metaHandlers.srv_b = () =>
      Promise.resolve({ status: 200, etag: null, body: rawConversationPage('c2', ['a', 'b']) })

    const { result } = await renderHook(() => useConversation('srv_b', 'c2'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data?.messages.length).toBe(2)
  })

  it('parses resumable + unavailable_reason from the meta', async () => {
    setActiveServers(['srv_c'])
    const page = rawConversationPage('c3', ['hi'])
    page.meta = { ...page.meta, resumable: false, unavailable_reason: 'worktree_removed' } as any
    metaHandlers.srv_c = () => Promise.resolve({ status: 200, etag: '"v1"', body: page })

    const { result } = await renderHook(() => useConversation('srv_c', 'c3'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data?.resumable).toBe(false)
    expect(result.current.data?.unavailableReason).toBe('worktree_removed')
  })

  it('leaves resumable undefined for older servers that omit it (back-compat)', async () => {
    setActiveServers(['srv_d'])
    metaHandlers.srv_d = () =>
      Promise.resolve({ status: 200, etag: '"v1"', body: rawConversationPage('c4', ['hi']) })

    const { result } = await renderHook(() => useConversation('srv_d', 'c4'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data?.resumable).toBeUndefined()
    expect(result.current.data?.unavailableReason).toBeUndefined()
  })
})

describe('useConversation — assistant prose alongside tool blocks', () => {
  it('keeps top-level text when the assistant message also has tool_use blocks', async () => {
    setActiveServers(['srv_e'])
    const page = {
      meta: { id: 'c5', project_name: 'proj-c5', message_count: 1 },
      messages: [
        {
          message_index: 0,
          role: 'assistant',
          text: 'Let me check that file.',
          content: [
            { type: 'thinking', thinking: 'hmm' },
            { type: 'tool_use', id: 'tu_1', name: 'Read', input: {} },
          ],
          timestamp: '2026-06-11T10:00:00.000Z',
        },
      ],
      message_pagination: { total: 1, before_index: 1, from_index: 0, has_more_older: false, next_before_index: null },
    }
    metaHandlers.srv_e = () => Promise.resolve({ status: 200, etag: '"v1"', body: page })

    const { result } = await renderHook(() => useConversation('srv_e', 'c5'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())

    const blocks = result.current.data!.messages[0].content
    expect(blocks.map((b) => b.type)).toEqual(['thinking', 'text', 'tool_use'])
    expect(blocks[1]).toMatchObject({ type: 'text', text: 'Let me check that file.' })
  })

  it('does not merge text into user tool_result messages (avoids duplicate rendering)', async () => {
    setActiveServers(['srv_f'])
    const page = {
      meta: { id: 'c6', project_name: 'proj-c6', message_count: 1 },
      messages: [
        {
          message_index: 0,
          role: 'user',
          text: 'file contents here',
          is_tool_result: true,
          content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: 'file contents here' }],
          timestamp: '2026-06-11T10:00:00.000Z',
        },
      ],
      message_pagination: { total: 1, before_index: 1, from_index: 0, has_more_older: false, next_before_index: null },
    }
    metaHandlers.srv_f = () => Promise.resolve({ status: 200, etag: '"v1"', body: page })

    const { result } = await renderHook(() => useConversation('srv_f', 'c6'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())

    const blocks = result.current.data!.messages[0].content
    expect(blocks.map((b) => b.type)).toEqual(['tool_result'])
  })
})

describe('useConversation — messageIndex on adapted rows', () => {
  it('sets messageIndex from the server message_index on a tail page', async () => {
    setActiveServers(['srv_idx_tail'])
    metaHandlers.srv_idx_tail = () =>
      Promise.resolve({ status: 200, etag: '"v1"', body: rawConversationPage('c_idx', ['a', 'b', 'c']) })

    const { result } = await renderHook(() => useConversation('srv_idx_tail', 'c_idx'), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data!.messages.map((m) => m.messageIndex)).toEqual([0, 1, 2])
  })

  it('sets messageIndex from the server message_index on an anchored page', async () => {
    setActiveServers(['srv_idx_anchor'])
    let lastPath = ''
    handlers.srv_idx_anchor = (path) => {
      lastPath = path
      return Promise.resolve(rawAnchoredPage('c_idx_a', 90, 120, 300, { anchor_index: 150, has_more_newer: true, next_after_index: 210 }))
    }

    const { result } = await renderHook(
      () => useConversation('srv_idx_anchor', 'c_idx_a', { anchorIndex: 150 }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(lastPath).toContain('msg_limit=120')
    expect(lastPath).toContain('anchor_index=150')
    expect(result.current.data!.messages[0].messageIndex).toBe(90)
    expect(result.current.data!.messages[59].messageIndex).toBe(149)
  })
})

describe('useConversation — anchored window (bidirectional pagination)', () => {
  it('fetches the anchored first page via plain get, bypassing the ETag path', async () => {
    setActiveServers(['srv_anchor'])
    let lastPath = ''
    handlers.srv_anchor = (path) => {
      lastPath = path
      return Promise.resolve(rawAnchoredPage('c_a', 90, 120, 300, { anchor_index: 150, has_more_newer: true, next_after_index: 210 }))
    }
    // Prove the ETag path is never touched: a meta handler that throws would
    // fail the test if getWithMeta were called for the anchored first page.
    metaHandlers.srv_anchor = () => Promise.reject(new Error('must not call getWithMeta for anchored page'))

    const { result } = await renderHook(
      () => useConversation('srv_anchor', 'c_a', { anchorIndex: 150 }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(lastPath).toBe('/api/conversations/c_a?msg_limit=120&anchor_index=150')
    expect(result.current.data!.messages.length).toBe(120)
    expect(result.current.hasNewerPage).toBe(true)
  })

  it('chains older pagination from an anchored first page via before_index', async () => {
    setActiveServers(['srv_anchor_older'])
    const paths: string[] = []
    handlers.srv_anchor_older = (path) => {
      paths.push(path)
      if (path.includes('anchor_index')) {
        return Promise.resolve(rawAnchoredPage('c_ao', 90, 120, 300, { anchor_index: 150, has_more_newer: true, next_after_index: 210 }))
      }
      // Older page request: before_index=90.
      return Promise.resolve(rawAnchoredPage('c_ao', 0, 90, 300, { has_more_older: false, next_before_index: null }))
    }

    const { result } = await renderHook(
      () => useConversation('srv_anchor_older', 'c_ao', { anchorIndex: 150 }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.hasNextPage).toBe(true)

    await result.current.fetchNextPage()
    await waitFor(() => expect(result.current.data!.messages.length).toBe(210))

    expect(paths.some((p) => p.includes('before_index=90'))).toBe(true)
    const indexes = result.current.data!.messages.map((m) => m.messageIndex)
    expect(indexes).toEqual(Array.from({ length: 210 }, (_, i) => i))
  })

  it('chains newer pagination from an anchored first page via after_index', async () => {
    setActiveServers(['srv_anchor_newer'])
    const paths: string[] = []
    handlers.srv_anchor_newer = (path) => {
      paths.push(path)
      if (path.includes('anchor_index')) {
        return Promise.resolve(rawAnchoredPage('c_an', 90, 120, 300, { anchor_index: 150, has_more_newer: true, next_after_index: 210 }))
      }
      // Newer page request: after_index=210, reaching the tail.
      return Promise.resolve(rawAnchoredPage('c_an', 210, 90, 300, { has_more_older: true, next_before_index: 210, has_more_newer: false, next_after_index: null }))
    }

    const { result } = await renderHook(
      () => useConversation('srv_anchor_newer', 'c_an', { anchorIndex: 150 }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.hasNewerPage).toBe(true)

    await result.current.fetchNewerPage()
    await waitFor(() => expect(result.current.data!.messages.length).toBe(210))

    expect(paths.some((p) => p.includes('after_index=210'))).toBe(true)
    const indexes = result.current.data!.messages.map((m) => m.messageIndex)
    expect(indexes).toEqual(Array.from({ length: 210 }, (_, i) => i + 90))
    expect(result.current.hasNewerPage).toBe(false)
  })

  it('keeps the tail-view query key and ETag path unchanged when no anchor is given', async () => {
    setActiveServers(['srv_no_anchor'])
    let getWithMetaCalled = false
    metaHandlers.srv_no_anchor = () => {
      getWithMetaCalled = true
      return Promise.resolve({ status: 200, etag: '"v1"', body: rawConversationPage('c_na', ['x']) })
    }

    const { result } = await renderHook(() => useConversation('srv_no_anchor', 'c_na'), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(getWithMetaCalled).toBe(true)
    expect(result.current.hasNewerPage).toBeFalsy()
  })
})

describe('useConversations — partial failure (Bug 32)', () => {
  it('returns conversations from healthy server when other server fails', async () => {
    setActiveServers(['srv-A', 'srv-B'])

    handlers['srv-A'] = () =>
      Promise.resolve([rawSession('a1'), rawSession('a2')]) as Promise<unknown>
    handlers['srv-B'] = () => Promise.reject(new Error('boom'))

    const { result } = await renderHook(() => useConversations(), { wrapper: createWrapper() })

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

    const { result } = await renderHook(() => useConversations(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())

    const statuses = useServerFetchStatusStore.getState().statuses
    expect(statuses['srv-A']?.status).toBe('ok')
    expect(statuses['srv-B']?.status).toBe('error')
    expect(statuses['srv-B']?.error).toContain('host unreachable')
  })

  it('single failing server still surfaces as a query error', async () => {
    setActiveServers(['srv-A'])
    handlers['srv-A'] = () => Promise.reject(new Error('down'))

    const { result } = await renderHook(() => useConversations(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })
})

describe('useConversationSearch — partial failure (Bug 32)', () => {
  it('returns matches from healthy server when other server fails', async () => {
    setActiveServers(['srv-A', 'srv-B'])

    handlers['srv-A'] = () => Promise.resolve([rawSession('a1', 'alpha')]) as Promise<unknown>
    handlers['srv-B'] = () => Promise.reject(new Error('5xx'))

    const { result } = await renderHook(() => useConversationSearch('alpha'), {
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

    const { result } = await renderHook(() => useEagerConversations(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isDone).toBe(true))

    expect(result.current.conversations.map((c) => c.id)).toEqual(['b1'])

    const statuses = useServerFetchStatusStore.getState().statuses
    expect(statuses['srv-A']?.status).toBe('error')
    expect(statuses['srv-B']?.status).toBe('ok')
  })
})

describe('useEagerConversations — cold-start count (fix: no refresh=1)', () => {
  it('never appends refresh=1 to the count URL', async () => {
    setActiveServers(['srv-X'])

    const countUrls: string[] = []
    handlers['srv-X'] = (path: string) => {
      if (path.includes('/api/conversations/count')) {
        countUrls.push(path)
        return Promise.resolve({ total: 0 }) as Promise<unknown>
      }
      return Promise.resolve([]) as Promise<unknown>
    }

    const { result } = await renderHook(() => useEagerConversations(undefined, 1), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isDone).toBe(true))

    expect(countUrls.length).toBeGreaterThan(0)
    for (const url of countUrls) {
      expect(url).not.toContain('refresh=1')
    }
  })

  it('records indexing (not error) when the count request times out', async () => {
    setActiveServers(['srv-slow'])

    handlers['srv-slow'] = (path: string) => {
      if (path.includes('/api/conversations/count')) {
        // Simulate the AbortError message produced by api-client timeout
        return Promise.reject(new Error('Failed to reach http://stub/api/conversations/count: AbortError: The operation was aborted'))
      }
      return Promise.resolve([]) as Promise<unknown>
    }

    const { result } = await renderHook(() => useEagerConversations(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isDone).toBe(true))

    const statuses = useServerFetchStatusStore.getState().statuses
    expect(statuses['srv-slow']?.status).toBe('indexing')
  })
})

describe('useEagerConversations — warm-up scan_progress surfaces a live count', () => {
  it('reflects scan_progress broadcasts while /count is still pending', async () => {
    setActiveServers(['srv-warm'])

    let resolveCount: ((v: unknown) => void) | undefined
    handlers['srv-warm'] = (path: string) => {
      if (path.includes('/api/conversations/count')) {
        return new Promise((resolve) => {
          resolveCount = resolve
        })
      }
      return Promise.resolve([]) as Promise<unknown>
    }

    const { result } = await renderHook(() => useEagerConversations(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(scanProgressHandler).not.toBeNull())
    expect(result.current.isCounting).toBe(true)

    scanProgressHandler?.({ type: 'scan_progress', serverId: 'srv-warm', scanned: 42, total: 120 })

    await waitFor(() => expect(result.current.total).toBe(120))
    expect(result.current.loaded).toBe(42)
    expect(result.current.isCounting).toBe(false)

    resolveCount?.({ total: 5 })
    await waitFor(() => expect(result.current.isDone).toBe(true))
  })
})

describe('useConversation — retention gcTime', () => {
  it('gives the plain tail query a 7-day gcTime', async () => {
    setActiveServers(['srv_gc_tail'])
    metaHandlers.srv_gc_tail = () =>
      Promise.resolve({ status: 200, etag: '"v1"', body: rawConversationPage('c_gc', ['x']) })
    const { qc, wrapper } = wrapperWithClient()

    const { result } = await renderHook(() => useConversation('srv_gc_tail', 'c_gc'), { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())

    const q = qc.getQueryCache().find({ queryKey: ['conversation', 'srv_gc_tail', 'c_gc'] })
    expect(q?.gcTime).toBe(1000 * 60 * 60 * 24 * 7)
  })

  it('keeps anchored windows at the 5-minute default gcTime', async () => {
    setActiveServers(['srv_gc_anchor'])
    handlers.srv_gc_anchor = () =>
      Promise.resolve(rawAnchoredPage('c_gca', 90, 120, 300, { anchor_index: 150, has_more_newer: true, next_after_index: 210 }))
    const { qc, wrapper } = wrapperWithClient()

    const { result } = await renderHook(
      () => useConversation('srv_gc_anchor', 'c_gca', { anchorIndex: 150 }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.data).toBeDefined())

    const q = qc.getQueryCache().find({ queryKey: ['conversation', 'srv_gc_anchor', 'c_gca', 'anchor-150'] })
    expect(q?.gcTime).toBe(1000 * 60 * 5)
  })
})
