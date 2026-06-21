import { useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { createApiForServer } from '@/services/api-client'
import { QUERY_GC_TIME } from '@/services/query-client'
import { useServersStore } from '@/stores/servers'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import type { Conversation, ConversationDetail, ConversationFilter, ConversationPage, Message, MessageContent, MultiConversation, TurnDuration, UnavailableReason } from '@/types/api'

// The Go server returns snake_case SessionMeta objects in a plain array.
// This adapter normalises them into the ConversationPage shape the app expects.
interface RawSessionMeta {
  id: string
  profile_id?: string
  project_name?: string
  project_path?: string
  last_updated_at?: string
  message_count?: number
  preview?: string
  git_branch?: string
  tool_names?: string[]
}

function toEpochMs(iso: string | undefined): number {
  return iso ? new Date(iso).getTime() : 0
}

function sortByLastMessageDesc(a: MultiConversation, b: MultiConversation): number {
  const ta = toEpochMs(a.lastMessage?.timestamp ?? a.lastActivity)
  const tb = toEpochMs(b.lastMessage?.timestamp ?? b.lastActivity)
  return tb - ta
}

// Paginated fetches across servers can yield the same conversation twice when
// rows reorder between the count and a page fetch (last_updated_at moves the
// row across an offset boundary). Drop later duplicates so FlatList keys stay unique.
function dedupeByServerAndId(items: MultiConversation[]): MultiConversation[] {
  const seen = new Set<string>()
  const out: MultiConversation[] = []
  for (const item of items) {
    const key = `${item.serverId}::${item.id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

function adaptPage(raw: RawSessionMeta[] | ConversationPage, offset: number, limit: number): ConversationPage {
  // Server may return ConversationPage directly (camelCase) or RawSessionMeta[] (snake_case array)
  if (!Array.isArray(raw)) {
    return raw as ConversationPage
  }
  const conversations: Conversation[] = raw.filter((s): s is RawSessionMeta => s != null).map((s) => ({
    id: s.id,
    title: s.project_name ?? 'Conversation',
    projectPath: s.project_path ?? '',
    branch: s.git_branch,
    messageCount: s.message_count ?? 0,
    lastActivity: s.last_updated_at ?? '',
  }))
  return {
    conversations,
    hasMore: raw.length === limit,
    offset,
    total: offset + raw.length,
  }
}

/** Multi-conversation page with serverId on each entry. */
interface MultiConversationPage {
  conversations: MultiConversation[]
  hasMore: boolean
}

/** Increment (e.g. pull-to-refresh) to bust the streamer conversation cache on the first page. */
export function useConversations(filter?: ConversationFilter, refreshEpoch = 0) {
  const limit = 50
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const servers = useServersStore((s) => s.servers)

  const recordSuccess = useServerFetchStatusStore((s) => s.recordSuccess)
  const recordFailure = useServerFetchStatusStore((s) => s.recordFailure)

  return useInfiniteQuery({
    queryKey: ['conversations', filter, refreshEpoch, ...displayedServerIds],
    queryFn: async ({ pageParam = 0 }): Promise<MultiConversationPage> => {
      // Bug 32: use allSettled so one unreachable server doesn't blank the Hub.
      // Rejected results update the per-server fetch-status store, which the
      // header dot + ServerStatusModal read to surface partial failure.
      const settled = await Promise.allSettled(
        displayedServerIds.map(async (serverId) => {
          const api = createApiForServer(serverId)
          const params = new URLSearchParams()
          if (filter?.projectPath) params.set('project', filter.projectPath)
          if (filter?.dateFrom) params.set('dateFrom', filter.dateFrom)
          if (filter?.dateTo) params.set('dateTo', filter.dateTo)
          if (filter?.profileId) params.set('profileId', filter.profileId)
          if (filter?.provider) params.set('provider', filter.provider)
          params.set('limit', String(limit))
          params.set('offset', String(pageParam))
          if (pageParam === 0 && refreshEpoch > 0) {
            params.set('refresh', '1')
          }
          const raw = await api.get<RawSessionMeta[] | ConversationPage>(
            `/api/conversations?${params.toString()}`,
          )
          const page = adaptPage(raw, pageParam as number, limit)
          return { serverId, page }
        })
      )

      const fulfilled: { serverId: string; page: ConversationPage }[] = []
      const failedServers: string[] = []
      settled.forEach((result, idx) => {
        const serverId = displayedServerIds[idx]
        if (result.status === 'fulfilled') {
          fulfilled.push(result.value)
          recordSuccess(serverId)
        } else {
          failedServers.push(serverId)
          recordFailure(serverId, result.reason)
        }
      })

      // Single-server install (or every server failed): surface as a query
      // error — Hub renders its existing error/empty state, matching the
      // pre-fix behaviour for that case.
      if (fulfilled.length === 0 && failedServers.length > 0) {
        const firstReject = settled.find(
          (r): r is PromiseRejectedResult => r.status === 'rejected',
        )
        throw firstReject?.reason ?? new Error('All servers failed')
      }

      // Merge conversations from all fulfilled servers, tag with serverId.
      const merged: MultiConversation[] = []
      let anyHasMore = false
      for (const { serverId, page } of fulfilled) {
        const label = servers[serverId]?.label
        for (const conv of page.conversations) {
          merged.push({ ...conv, serverId, serverLabel: label })
        }
        if (page.hasMore) anyHasMore = true
      }

      // Multi-server note: each server paginates with the same offset; ordering is best-effort
      // vs a global merge. Single-server installs get correct cursor semantics.

      // Sort by lastActivity descending
      merged.sort(sortByLastMessageDesc)

      return { conversations: dedupeByServerAndId(merged), hasMore: anyHasMore }
    },
    getNextPageParam: (last: MultiConversationPage, _allPages, lastPageParam) =>
      last.hasMore ? (lastPageParam as number) + limit : undefined,
    initialPageParam: 0,
    enabled: displayedServerIds.length > 0,
  })
}

// Raw shape returned by the Go server for a single conversation.
interface RawContentBlock {
  type: string
  // text
  text?: string
  // thinking
  thinking?: string
  signature?: string
  // tool_use
  id?: string
  name?: string
  input?: Record<string, unknown>
  // tool_result
  tool_use_id?: string
  content?: string
  is_error?: boolean
}

interface RawMessage {
  /** Stable index in the full filtered message list (for pagination + React keys). */
  message_index?: number
  uuid?: string | null
  role: string
  timestamp: string
  text: string
  tool_calls?: string[]
  content?: RawContentBlock[]
  model?: string
  has_images?: boolean
  parent_uuid?: string | null
  permission_mode?: string | null
  is_sidechain?: boolean
  is_tool_result?: boolean
  attachment?: Record<string, unknown> | null
}

export interface ConversationMessagePagination {
  total: number
  before_index: number
  from_index: number
  has_more_older: boolean
  next_before_index: number | null
}

interface RawConversationDetail {
  meta: RawSessionMeta & {
    last_prompt?: string
    resumable?: boolean
    unavailable_reason?: UnavailableReason
    provider?: 'claude-code' | 'codex-cli'
  }
  messages: RawMessage[]
  message_pagination?: ConversationMessagePagination
  turn_durations?: TurnDuration[]
}

// Resolve a tool name from tool_use_id by looking at sibling content blocks.
function resolveToolName(toolUseId: string | undefined, blocks: RawContentBlock[] | undefined): string {
  if (!toolUseId || !blocks) return 'Tool'
  const match = blocks.find((b) => b.type === 'tool_use' && b.id === toolUseId)
  return match?.name ?? 'Tool'
}

function adaptRawMessage(m: RawMessage, convId: string, fallbackIndex: number): Message {
  const content: MessageContent[] = []

  if (m.content && m.content.length > 0) {
    for (const block of m.content) {
      if (block.type === 'thinking') {
        content.push({ type: 'thinking', thinking: block.thinking ?? '', signature: block.signature })
      } else if (block.type === 'text' && block.text) {
        content.push({ type: 'text', text: block.text })
      } else if (block.type === 'tool_use') {
        content.push({ type: 'tool_use', id: block.id, name: block.name ?? '', input: block.input ?? {} })
      } else if (block.type === 'tool_result') {
        content.push({
          type: 'tool_result',
          toolUseId: block.tool_use_id,
          toolName: resolveToolName(block.tool_use_id, m.content),
          content: block.content ?? '',
          isError: block.is_error,
        })
      }
    }
  } else {
    if (m.text) content.push({ type: 'text', text: m.text })
    if (m.tool_calls) {
      m.tool_calls.forEach((name) =>
        content.push({ type: 'tool_use', name, input: {} })
      )
    }
  }

  const idx = m.message_index ?? fallbackIndex
  return {
    id: `${convId}-${idx}`,
    uuid: m.uuid,
    role: m.role as 'user' | 'assistant',
    content,
    timestamp: m.timestamp,
    has_images: m.has_images,
    parent_uuid: m.parent_uuid,
    permission_mode: m.permission_mode,
    is_sidechain: m.is_sidechain,
    is_tool_result: m.is_tool_result,
    attachment: m.attachment,
  }
}

/** Pages are ordered newest-chunk first (infinite query page 0 = tail). Merge oldest → newest. */
function mergeConversationPages(pages: RawConversationDetail[]): ConversationDetail {
  if (pages.length === 0) {
    throw new Error('mergeConversationPages: empty pages')
  }
  const first = pages[0]
  const convId = first.meta.id
  const messages: Message[] = [...pages]
    .reverse()
    .flatMap((page) =>
      (page.messages ?? []).map((m, i) =>
        adaptRawMessage(m, convId, m.message_index ?? (page.message_pagination?.from_index ?? 0) + i),
      ),
    )

  return {
    id: convId,
    title: first.meta.project_name ?? 'Conversation',
    projectPath: first.meta.project_path ?? '',
    branch: first.meta.git_branch,
    messageCount: first.meta.message_count ?? messages.length,
    lastActivity: first.meta.last_updated_at ?? '',
    messages,
    lastPrompt: first.meta.last_prompt,
    turn_durations: first.turn_durations,
    resumable: first.meta.resumable,
    unavailableReason: first.meta.unavailable_reason,
    provider: first.meta.provider,
  }
}

const CONVERSATION_MESSAGE_LIMIT = 80

// First-page ETags, keyed by `${serverId}::${id}`. The server sets an ETag on
// the first-page (newest) response of /api/conversations/{id}; echoing it back
// via If-None-Match lets the server answer 304 when the conversation is
// unchanged, so we skip re-downloading the page. Module-level so it survives
// re-renders and the queryFn closure; only the first page participates (older
// pages are immutable history and never revalidate).
const firstPageEtags = new Map<string, string>()

export function useConversation(serverId: string, id: string) {
  const api = createApiForServer(serverId)
  const queryClient = useQueryClient()
  const queryKey = ['conversation', serverId, id] as const
  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: -1,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams()
      params.set('msg_limit', String(CONVERSATION_MESSAGE_LIMIT))
      const isFirstPage = pageParam === -1
      if (!isFirstPage) {
        params.set('before_index', String(pageParam))
      }
      const path = `/api/conversations/${encodeURIComponent(id)}?${params.toString()}`

      // Back-pages are immutable history — fetch normally, no conditional check.
      if (!isFirstPage) {
        return api.get<RawConversationDetail>(path)
      }

      // First page: send If-None-Match with the last known ETag (if any) and
      // use the conditional path so a 304 keeps the cached copy.
      const etagKey = `${serverId}::${id}`
      const knownEtag = firstPageEtags.get(etagKey)
      const res = await api.getWithMeta<RawConversationDetail>(
        path,
        knownEtag ? { headers: { 'If-None-Match': knownEtag } } : undefined,
      )

      if (res.status === 304) {
        // Unchanged: reuse the previously cached first page so merge output is
        // identical. If somehow nothing is cached, fall back to a full fetch.
        const cached = queryClient.getQueryData<InfiniteData<RawConversationDetail, number>>(queryKey)
        const cachedFirst = cached?.pages?.[0]
        if (cachedFirst) return cachedFirst
        return api.get<RawConversationDetail>(path)
      }

      // 200: remember the validator (null against a non-ETag server clears it,
      // so we simply stop sending If-None-Match — graceful degradation).
      if (res.etag) firstPageEtags.set(etagKey, res.etag)
      else firstPageEtags.delete(etagKey)
      // body is non-null on a 200 from requestWithMeta.
      return res.body as RawConversationDetail
    },
    getNextPageParam: (last) => {
      const p = last.message_pagination
      if (!p?.has_more_older || p.next_before_index == null) return undefined
      return p.next_before_index
    },
    enabled: Boolean(serverId && id),
  })

  const data = useMemo(() => {
    if (!query.data?.pages.length) return undefined
    return mergeConversationPages(query.data.pages)
  }, [query.data])

  const firstPage = query.data?.pages[0]
  const totalMessages = firstPage?.message_pagination?.total ?? 0
  const loadedMessages = useMemo(
    () => (query.data?.pages ?? []).reduce((sum, p) => sum + p.messages.length, 0),
    [query.data],
  )

  return {
    data,
    error: query.error,
    refetch: query.refetch,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    totalMessages,
    loadedMessages,
  }
}

// Sentinel thrown when the /conversations/count request times out so the outer
// handler can classify the server as "indexing" rather than "unreachable".
class CountTimeoutError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause))
    this.name = 'CountTimeoutError'
  }
}

function isCountTimeoutError(err: unknown): boolean {
  return err instanceof CountTimeoutError
}

// Drain one server's pages sequentially — keeps server load proportional to
// progress rather than firing N pages × 3 servers in parallel at every focus.
async function fetchAllConversationPagesForServer(
  serverId: string,
  serverLabel: string | undefined,
  filter: ConversationFilter | undefined,
  refreshEpoch: number,
  onProgress: (loadedSoFar: number, total: number) => void,
  signal?: AbortSignal,
): Promise<MultiConversation[]> {
  const limit = 50
  const api = createApiForServer(serverId)

  const countParams = new URLSearchParams()
  if (filter?.projectPath) countParams.set('project', filter.projectPath)
  if (filter?.provider) countParams.set('provider', filter.provider)
  const countQs = countParams.toString()
  let total: number
  try {
    const res = await api.get<{ total: number }>(
      `/api/conversations/count${countQs ? `?${countQs}` : ''}`,
      { signal },
    )
    total = res.total
  } catch (err) {
    // Re-throw aborts as CountTimeoutError so the caller can distinguish
    // "server is indexing" from "server is unreachable".
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('AbortError') || msg.includes('cancelled') || msg.includes('timed out')) {
      throw new CountTimeoutError(err)
    }
    throw err
  }

  onProgress(0, total)

  const collected: MultiConversation[] = []
  const pageCount = Math.ceil(total / limit)
  for (let page = 0; page < pageCount; page++) {
    if (signal?.aborted) throw new Error('aborted')

    const params = new URLSearchParams()
    if (filter?.projectPath) params.set('project', filter.projectPath)
    if (filter?.provider) params.set('provider', filter.provider)
    params.set('limit', String(limit))
    params.set('offset', String(page * limit))
    const raw = await api.get<RawSessionMeta[] | ConversationPage>(
      `/api/conversations?${params.toString()}`,
      { signal },
    )
    for (const c of adaptPage(raw, page * limit, limit).conversations) {
      collected.push({ ...c, serverId, serverLabel })
    }
    onProgress(collected.length, total)
  }

  return collected
}

interface EagerConversationsProgress {
  loaded: number
  total: number
}

export function useEagerConversations(filter?: ConversationFilter, refreshEpoch = 0) {
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const servers = useServersStore((s) => s.servers)

  const serversRef = useRef(servers)
  useEffect(() => {
    serversRef.current = servers
  }, [servers])

  const [progress, setProgress] = useState<EagerConversationsProgress>({ loaded: 0, total: 0 })
  const recordSuccess = useServerFetchStatusStore((s) => s.recordSuccess)
  const recordFailure = useServerFetchStatusStore((s) => s.recordFailure)
  const recordIndexing = useServerFetchStatusStore((s) => s.recordIndexing)

  const queryKey = useMemo(
    () => ['conversations-eager', filter, refreshEpoch, ...displayedServerIds],
    [filter, refreshEpoch, displayedServerIds],
  )

  const query = useQuery<MultiConversation[], Error>({
    queryKey,
    queryFn: async ({ signal }) => {
      setProgress({ loaded: 0, total: 0 })

      // Run all servers in parallel so an unreachable server's timeout doesn't
      // block healthy servers from returning data. Progress counters are shared
      // across concurrent callbacks via a plain object updated in-place.
      const progressByServer = new Map<string, { loaded: number; total: number }>()
      const emitProgress = () => {
        let loaded = 0
        let total = 0
        for (const p of progressByServer.values()) {
          loaded += p.loaded
          total += p.total
        }
        setProgress({ loaded, total })
      }

      const settled = await Promise.allSettled(
        displayedServerIds.map(async (serverId) => {
          const label = serversRef.current[serverId]?.label
          progressByServer.set(serverId, { loaded: 0, total: 0 })
          const items = await fetchAllConversationPagesForServer(
            serverId,
            label,
            filter,
            refreshEpoch,
            (loadedSoFar, totalSoFar) => {
              progressByServer.set(serverId, { loaded: loadedSoFar, total: totalSoFar })
              emitProgress()
            },
            signal,
          )
          return { serverId, items }
        })
      )

      const merged: MultiConversation[] = []
      let fulfilledCount = 0
      let lastFailure: unknown = null

      for (const result of settled) {
        if (result.status === 'fulfilled') {
          merged.push(...result.value.items)
          fulfilledCount++
          recordSuccess(result.value.serverId)
        } else {
          // Caller-initiated abort must propagate so the query is cancelled cleanly.
          if (signal?.aborted) throw result.reason
          lastFailure = result.reason
          // Extract serverId from the rejection — find matching index.
          const idx = settled.indexOf(result)
          if (idx !== -1) {
            // A count-request timeout means the server responded to other requests
            // but the index scan is still warm — show "indexing", not "unreachable".
            if (isCountTimeoutError(result.reason)) {
              recordIndexing(displayedServerIds[idx])
            } else {
              recordFailure(displayedServerIds[idx], result.reason)
            }
          }
        }
      }

      if (fulfilledCount === 0 && displayedServerIds.length > 0) {
        throw lastFailure ?? new Error('All servers failed')
      }

      merged.sort(sortByLastMessageDesc)
      return dedupeByServerAndId(merged)
    },
    enabled: displayedServerIds.length > 0,
    staleTime: 0,
    gcTime: QUERY_GC_TIME,
  })

  const conversations = query.data ?? []
  const isDone =
    displayedServerIds.length === 0 || (query.isFetched && !query.isFetching)
  const isCounting = !isDone && progress.total === 0

  return {
    conversations,
    loaded: progress.loaded,
    total: progress.total,
    isDone,
    isCounting,
  }
}

export function useConversationSearch(query: string) {
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const servers = useServersStore((s) => s.servers)
  const recordSuccess = useServerFetchStatusStore((s) => s.recordSuccess)
  const recordFailure = useServerFetchStatusStore((s) => s.recordFailure)

  return useQuery({
    queryKey: ['conversations', 'search', query, ...displayedServerIds],
    queryFn: async () => {
      // Bug 32: allSettled — one failing server shouldn't suppress matches
      // from healthy servers.
      const settled = await Promise.allSettled(
        displayedServerIds.map(async (serverId) => {
          const api = createApiForServer(serverId)
          const raw = await api.get<RawSessionMeta[]>(`/api/search?q=${encodeURIComponent(query)}&limit=50`)
          return { serverId, page: adaptPage(raw, 0, 50) }
        })
      )

      const merged: MultiConversation[] = []
      let anyFulfilled = false
      settled.forEach((result, idx) => {
        const serverId = displayedServerIds[idx]
        if (result.status === 'fulfilled') {
          anyFulfilled = true
          recordSuccess(serverId)
          const { page } = result.value
          const label = servers[serverId]?.label
          for (const conv of page.conversations) {
            merged.push({ ...conv, serverId, serverLabel: label })
          }
        } else {
          recordFailure(serverId, result.reason)
        }
      })

      if (!anyFulfilled && displayedServerIds.length > 0) {
        const firstReject = settled.find(
          (r): r is PromiseRejectedResult => r.status === 'rejected',
        )
        throw firstReject?.reason ?? new Error('All servers failed')
      }

      merged.sort(sortByLastMessageDesc)
      const deduped = dedupeByServerAndId(merged)

      return { conversations: deduped, hasMore: false, offset: 0, total: deduped.length }
    },
    enabled: query.length > 0 && displayedServerIds.length > 0,
  })
}
