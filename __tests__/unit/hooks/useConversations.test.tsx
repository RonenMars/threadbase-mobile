import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import React from 'react'
import { AppState } from 'react-native'
import {
  useConversation,
  useConversations,
  useConversationSearch,
  useEagerConversations,
} from '@/hooks/useConversations'
import { __resetTriggerGuardForTests } from '@/hooks/conversationCursor'
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
// Captures the trigger effect's onAnyStatusChange listener so tests can drive
// WS connected transitions directly.
let statusListener: ((sid: string, s: string) => void) | null = null

jest.mock('@/services/ws-client', () => ({
  wsManager: {
    onAll: (type: string, handler: (msg: any) => void) => {
      if (type === 'scan_progress') scanProgressHandler = handler
      return () => {
        if (type === 'scan_progress') scanProgressHandler = null
      }
    },
    onAnyStatusChange: (l: (sid: string, s: string) => void) => {
      statusListener = l
      return () => { statusListener = null }
    },
    getClient: () => ({ on: () => () => {} }),
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
    // Delta-on-open: a tail view with a cached indexed message now exposes a
    // { resume } cursor, so hasNewerPage is true (was falsy before the resume lane).
    expect(result.current.hasNewerPage).toBe(true)
  })
})

describe('useConversation — { resume } delta on the tail view', () => {
  it('resumes from the derived cursor: after_index GET, plain get (no If-None-Match), merges newer messages', async () => {
    setActiveServers(['srv_resume'])
    const paths: string[] = []
    // Tail first page: messages 0..2, total 3. No has_more_newer field (plain tail).
    metaHandlers.srv_resume = () =>
      Promise.resolve({ status: 200, etag: '"v1"', body: rawConversationPage('c_r', ['a', 'b', 'c']) })
    // after_index=2 delta: two new messages 3,4 out of total 5, no more newer.
    handlers.srv_resume = (path) => {
      paths.push(path)
      return Promise.resolve(
        rawAnchoredPage('c_r', 3, 2, 5, { has_more_newer: false, next_after_index: null }),
      )
    }

    const { result } = await renderHook(() => useConversation('srv_resume', 'c_r'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data!.messages.length).toBe(3))

    // Cursor = max index = 2 → hasNewerPage true on the tail view now.
    expect(result.current.hasNewerPage).toBe(true)

    await result.current.fetchNewerPage()
    await waitFor(() => expect(result.current.data!.messages.length).toBe(5))

    expect(paths.some((p) => p.includes('after_index=2'))).toBe(true)
    expect(paths.some((p) => p.includes('msg_limit=80'))).toBe(true)
    // Delta path must NOT send If-None-Match (it's a plain get, not getWithMeta).
    const indexes = result.current.data!.messages.map((m) => m.messageIndex)
    expect(indexes).toEqual([0, 1, 2, 3, 4])
  })

  it('does not expose a resume cursor when no messages are cached (fresh install)', async () => {
    setActiveServers(['srv_fresh'])
    metaHandlers.srv_fresh = () =>
      Promise.resolve({ status: 200, etag: '"v1"', body: rawConversationPage('c_f', []) })

    const { result } = await renderHook(() => useConversation('srv_fresh', 'c_f'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())

    // No indexed messages → no cursor → hasNewerPage stays falsy.
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

describe('useConversation — retry hygiene', () => {
  it('does not refetch the page chain on remount within staleTime', async () => {
    setActiveServers(['srv_stale'])
    let getWithMetaCalls = 0
    metaHandlers.srv_stale = () => {
      getWithMetaCalls += 1
      return Promise.resolve({ status: 200, etag: '"v1"', body: rawConversationPage('c_s', ['a']) })
    }
    const { wrapper } = wrapperWithClient()

    const first = await renderHook(() => useConversation('srv_stale', 'c_s'), { wrapper })
    await waitFor(() => expect(first.result.current.data).toBeDefined())
    expect(getWithMetaCalls).toBe(1)

    // Remount against the same client + warm cache: refetchOnMount:false + fresh
    // (staleTime 15s) means no second tail fetch.
    const second = await renderHook(() => useConversation('srv_stale', 'c_s'), { wrapper })
    await waitFor(() => expect(second.result.current.data).toBeDefined())
    expect(getWithMetaCalls).toBe(1)
  })

  it('sets a 15s staleTime and disables the three auto-refetch triggers on the query', async () => {
    setActiveServers(['srv_opts'])
    metaHandlers.srv_opts = () =>
      Promise.resolve({ status: 200, etag: '"v1"', body: rawConversationPage('c_o', ['a']) })
    const { qc, wrapper } = wrapperWithClient()

    const { result } = await renderHook(() => useConversation('srv_opts', 'c_o'), { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())

    const q = qc.getQueryCache().find({ queryKey: ['conversation', 'srv_opts', 'c_o'] })
    const opts = q?.options as {
      staleTime?: number
      refetchOnMount?: boolean
      refetchOnWindowFocus?: boolean
      refetchOnReconnect?: boolean
    }
    expect(opts.staleTime).toBe(15_000)
    expect(opts.refetchOnMount).toBe(false)
    expect(opts.refetchOnWindowFocus).toBe(false)
    expect(opts.refetchOnReconnect).toBe(false)
  })
})

// A cached tail InfiniteData with messages 0..2 and pageParam -1.
function warmTailCache(id: string) {
  return {
    pages: [rawConversationPage(id, ['a', 'b', 'c'])],
    pageParams: [-1],
  }
}

describe('useConversation — consolidated delta trigger', () => {
  beforeEach(() => __resetTriggerGuardForTests())

  it('enabled: false suppresses the trigger — warm cache, zero network', async () => {
    setActiveServers(['srv_dis'])
    const paths: string[] = []
    handlers.srv_dis = (path) => {
      paths.push(path)
      return Promise.resolve(rawAnchoredPage('c_dis', 3, 1, 4, { has_more_newer: false, next_after_index: null }))
    }
    metaHandlers.srv_dis = () => Promise.reject(new Error('no tail fetch expected'))
    const { qc, wrapper } = wrapperWithClient()
    qc.setQueryData(['conversation', 'srv_dis', 'c_dis'], warmTailCache('c_dis'))

    await renderHook(() => useConversation('srv_dis', 'c_dis', { enabled: false }), { wrapper })

    // Imperative fetches bypass react-query's `enabled`, so without the effect
    // gate this would fire a delta. Give any stray trigger time to surface.
    await new Promise((r) => setTimeout(r, 50))
    expect(paths).toHaveLength(0)
  })

  it('fires one after_index delta on mount when a cursor exists in the warm cache', async () => {
    setActiveServers(['srv_mt'])
    const paths: string[] = []
    handlers.srv_mt = (path) => {
      paths.push(path)
      return Promise.resolve(rawAnchoredPage('c_mt', 3, 1, 4, { has_more_newer: false, next_after_index: null }))
    }
    metaHandlers.srv_mt = () => Promise.reject(new Error('tail fetch must not fire — cache is warm'))
    const { qc, wrapper } = wrapperWithClient()
    qc.setQueryData(['conversation', 'srv_mt', 'c_mt'], warmTailCache('c_mt'))

    const { result } = await renderHook(() => useConversation('srv_mt', 'c_mt'), { wrapper })

    await waitFor(() => expect(paths.filter((p) => p.includes('after_index=2'))).toHaveLength(1))
    await waitFor(() => expect(result.current.data!.messages.length).toBe(4))
    // Only the delta fired, never a tail (-1) fetch.
    expect(paths.every((p) => p.includes('after_index'))).toBe(true)
  })

  it('drains a >80-message backlog across sequential after_index pages, guard stamped once', async () => {
    setActiveServers(['srv_drain'])
    const paths: string[] = []
    // Warm cache ends at index 2 (cursor 2). Backlog: 3 pages.
    handlers.srv_drain = (path) => {
      paths.push(path)
      if (path.includes('after_index=2')) {
        // 80 new (3..82), more newer.
        return Promise.resolve(rawAnchoredPage('c_dr', 3, 80, 243, { has_more_newer: true, next_after_index: 83 }))
      }
      if (path.includes('after_index=83')) {
        return Promise.resolve(rawAnchoredPage('c_dr', 83, 80, 243, { has_more_newer: true, next_after_index: 163 }))
      }
      // after_index=163 → last 80 (163..242), no more.
      return Promise.resolve(rawAnchoredPage('c_dr', 163, 80, 243, { has_more_newer: false, next_after_index: null }))
    }
    metaHandlers.srv_drain = () => Promise.reject(new Error('no tail fetch expected'))
    const { qc, wrapper } = wrapperWithClient()
    qc.setQueryData(['conversation', 'srv_drain', 'c_dr'], warmTailCache('c_dr'))

    const { result } = await renderHook(() => useConversation('srv_drain', 'c_dr'), { wrapper })

    await waitFor(() => expect(result.current.data!.messages.length).toBe(243))
    // Exactly three sequential after_index GETs.
    const afterPaths = paths.filter((p) => p.includes('after_index'))
    expect(afterPaths).toHaveLength(3)
    expect(afterPaths[0]).toContain('after_index=2')
    expect(afterPaths[1]).toContain('after_index=83')
    expect(afterPaths[2]).toContain('after_index=163')
    // Full range 0..242, no gap.
    const indexes = result.current.data!.messages.map((m) => m.messageIndex)
    expect(indexes).toEqual(Array.from({ length: 243 }, (_, i) => i))
  })

  it('strips the empty husk on an empty-200 delta and stays resumable', async () => {
    setActiveServers(['srv_empty'])
    let deltaCalls = 0
    handlers.srv_empty = () => {
      deltaCalls += 1
      return Promise.resolve(rawAnchoredPage('c_e', 3, 0, 3, { has_more_newer: false, next_after_index: null }))
    }
    metaHandlers.srv_empty = () => Promise.reject(new Error('no tail fetch'))
    const { qc, wrapper } = wrapperWithClient()
    qc.setQueryData(['conversation', 'srv_empty', 'c_e'], warmTailCache('c_e'))

    const { result } = await renderHook(() => useConversation('srv_empty', 'c_e'), { wrapper })

    await waitFor(() => expect(deltaCalls).toBe(1))
    // Empty page stripped → back to the original single cached page.
    await waitFor(() => {
      const data = qc.getQueryData(['conversation', 'srv_empty', 'c_e']) as { pages: unknown[] }
      expect(data.pages).toHaveLength(1)
    })
    expect(result.current.data!.messages.length).toBe(3)
    // Still resumable afterward: hasNewerPage stays true (cursor still exists).
    expect(result.current.hasNewerPage).toBe(true)
  })

  it('discards + refetches tail when total <= cursor (truncation), no merge', async () => {
    setActiveServers(['srv_trunc'])
    let tailRefetches = 0
    // Delta reports total=2 while our cursor is 2 → total === cursor → invalid.
    handlers.srv_trunc = () =>
      Promise.resolve(rawAnchoredPage('c_t', 3, 1, 2, { has_more_newer: false, next_after_index: null }))
    metaHandlers.srv_trunc = () => {
      tailRefetches += 1
      return Promise.resolve({ status: 200, etag: '"v2"', body: rawConversationPage('c_t', ['x', 'y']) })
    }
    const { qc, wrapper } = wrapperWithClient()
    qc.setQueryData(['conversation', 'srv_trunc', 'c_t'], warmTailCache('c_t'))

    const { result } = await renderHook(() => useConversation('srv_trunc', 'c_t'), { wrapper })

    // The invalid delta triggers resetQueries → discard + refetch from -1 (getWithMeta).
    await waitFor(() => expect(tailRefetches).toBeGreaterThanOrEqual(1))
    await waitFor(() => expect(result.current.data!.messages.map((m) => m.messageIndex)).toEqual([0, 1]))
  })

  it('WS flap ×5 within 5s fires at most one delta, zero tail refetches', async () => {
    jest.useFakeTimers()
    setActiveServers(['srv_flap'])
    let deltaCalls = 0
    handlers.srv_flap = () => {
      deltaCalls += 1
      return Promise.resolve(rawAnchoredPage('c_fl', 3, 1, 4, { has_more_newer: false, next_after_index: null }))
    }
    let tailCalls = 0
    metaHandlers.srv_flap = () => { tailCalls += 1; return Promise.reject(new Error('no tail')) }
    const { qc, wrapper } = wrapperWithClient()
    qc.setQueryData(['conversation', 'srv_flap', 'c_fl'], warmTailCache('c_fl'))

    const { unmount } = await renderHook(() => useConversation('srv_flap', 'c_fl'), { wrapper })
    // Mount already fired one. Clear it so we measure the flaps in isolation.
    await waitFor(() => expect(deltaCalls).toBe(1))

    for (let i = 0; i < 5; i++) {
      statusListener?.('srv_flap', 'connected')
      await act(() => jest.advanceTimersByTime(500)) // 5 × 500ms = 2.5s, inside the 5s guard
    }
    await waitFor(() => expect(deltaCalls).toBe(1)) // guard held — still just the mount delta
    expect(tailCalls).toBe(0)
    unmount()
    jest.useRealTimers()
  })

  it('foreground fires one delta; a later foreground after an empty-200 fires a fresh delta (not latched)', async () => {
    jest.useFakeTimers()
    setActiveServers(['srv_fg'])
    // Both foreground deltas return empty-200 (nothing new) — the point is that
    // the SECOND foreground still issues a request, proving no latch.
    let deltaCalls = 0
    handlers.srv_fg = () => {
      deltaCalls += 1
      return Promise.resolve(rawAnchoredPage('c_fg', 3, 0, 3, { has_more_newer: false, next_after_index: null }))
    }
    metaHandlers.srv_fg = () => Promise.reject(new Error('no tail fetch expected'))

    // Capture every AppState 'change' listener the render tree registers —
    // react-query's own focusManager also subscribes to 'change' (via
    // services/query-client.ts), so a single-slot capture can be clobbered by
    // that unrelated listener. Fire the whole list, matching real AppState fan-out.
    // Deliberately never mockRestore(): the real AppState.addEventListener
    // throws in this test environment (no native module), so restoring it
    // would break every AppState subscription — including this effect's —
    // in tests that run after this one in the same file.
    const appStateHandlers: ((s: string) => void)[] = []
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'change') appStateHandlers.push(handler as (s: string) => void)
      return { remove: jest.fn() } as never
    })
    const fireForeground = () => appStateHandlers.forEach((h) => h('active'))

    const { qc, wrapper } = wrapperWithClient()
    qc.setQueryData(['conversation', 'srv_fg', 'c_fg'], warmTailCache('c_fg'))

    const { unmount } = await renderHook(() => useConversation('srv_fg', 'c_fg'), { wrapper })
    // Mount already fired one delta; strip pass leaves the single cached page.
    await waitFor(() => expect(deltaCalls).toBe(1))
    await waitFor(() => {
      const d = qc.getQueryData(['conversation', 'srv_fg', 'c_fg']) as { pages: unknown[] }
      expect(d.pages).toHaveLength(1)
    })

    // First foreground within the 5s guard → blocked (still 1).
    fireForeground()
    await waitFor(() => expect(deltaCalls).toBe(1))

    // Advance past the 5s guard, then foreground again → a FRESH delta fires.
    await act(() => jest.advanceTimersByTime(6000))
    fireForeground()
    await waitFor(() => expect(deltaCalls).toBe(2))
    // Still empty-200 → still one cached page, no churn.
    await waitFor(() => {
      const d = qc.getQueryData(['conversation', 'srv_fg', 'c_fg']) as { pages: unknown[] }
      expect(d.pages).toHaveLength(1)
    })

    unmount()
    jest.useRealTimers()
  })

  it('two concurrent consumers of the same key share one in-flight delta', async () => {
    setActiveServers(['srv_dup'])
    let deltaCalls = 0
    handlers.srv_dup = () => {
      deltaCalls += 1
      return Promise.resolve(rawAnchoredPage('c_du', 3, 1, 4, { has_more_newer: false, next_after_index: null }))
    }
    metaHandlers.srv_dup = () => Promise.reject(new Error('no tail'))
    const { qc, wrapper } = wrapperWithClient()
    qc.setQueryData(['conversation', 'srv_dup', 'c_du'], warmTailCache('c_du'))

    // Two hook instances, same key, same client.
    await renderHook(
      () => {
        useConversation('srv_dup', 'c_du')
        useConversation('srv_dup', 'c_du')
      },
      { wrapper },
    )

    await waitFor(() => expect(deltaCalls).toBe(1))
  })
})
