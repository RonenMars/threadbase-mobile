import { useMemo, useRef, useState, useEffect } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { createApiForServer } from '@/services/api-client'
import { useServersStore } from '@/stores/servers'
import type { Conversation, ConversationDetail, ConversationFilter, ConversationPage, Message, MessageContent, MultiConversation } from '@/types/api'

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

  return useInfiniteQuery({
    queryKey: ['conversations', filter, refreshEpoch, ...displayedServerIds],
    queryFn: async ({ pageParam = 0 }): Promise<MultiConversationPage> => {
      const results = await Promise.all(
        displayedServerIds.map(async (serverId) => {
          const api = createApiForServer(serverId)
          const params = new URLSearchParams()
          if (filter?.projectPath) params.set('project', filter.projectPath)
          if (filter?.dateFrom) params.set('dateFrom', filter.dateFrom)
          if (filter?.dateTo) params.set('dateTo', filter.dateTo)
          if (filter?.profileId) params.set('profileId', filter.profileId)
          params.set('limit', String(limit))
          params.set('offset', String(pageParam))
          if (pageParam === 0 && refreshEpoch > 0) {
            params.set('refresh', '1')
          }
          const raw = await api.get<RawSessionMeta[] | ConversationPage>(
            `/api/conversations?${params.toString()}`,
          )
          return { serverId, page: adaptPage(raw, pageParam as number, limit) }
        })
      )

      // Merge conversations from all servers, tag with serverId
      const merged: MultiConversation[] = []
      let anyHasMore = false
      for (const { serverId, page } of results) {
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
  role: string
  timestamp: string
  text: string
  tool_calls?: string[]
  content?: RawContentBlock[]
  model?: string
}

export interface ConversationMessagePagination {
  total: number
  before_index: number
  from_index: number
  has_more_older: boolean
  next_before_index: number | null
}

interface RawConversationDetail {
  meta: RawSessionMeta
  messages: RawMessage[]
  message_pagination?: ConversationMessagePagination
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
      if (block.type === 'text' && block.text) {
        content.push({ type: 'text', text: block.text })
      } else if (block.type === 'tool_use') {
        content.push({ type: 'tool_use', name: block.name ?? '', input: block.input ?? {} })
      } else if (block.type === 'tool_result') {
        content.push({
          type: 'tool_result',
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
    role: m.role as 'user' | 'assistant',
    content,
    timestamp: m.timestamp,
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
  }
}

const CONVERSATION_MESSAGE_LIMIT = 80

export function useConversation(serverId: string, id: string) {
  const api = createApiForServer(serverId)
  const query = useInfiniteQuery({
    queryKey: ['conversation', serverId, id],
    initialPageParam: -1,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams()
      params.set('msg_limit', String(CONVERSATION_MESSAGE_LIMIT))
      if (pageParam !== -1) {
        params.set('before_index', String(pageParam))
      }
      const path = `/api/conversations/${encodeURIComponent(id)}?${params.toString()}`
      return api.get<RawConversationDetail>(path)
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
  if (refreshEpoch > 0) countParams.set('refresh', '1')
  const countQs = countParams.toString()
  const { total } = await api.get<{ total: number }>(
    `/api/conversations/count${countQs ? `?${countQs}` : ''}`,
    { signal },
  )

  onProgress(0, total)

  const collected: MultiConversation[] = []
  const pageCount = Math.ceil(total / limit)
  for (let page = 0; page < pageCount; page++) {
    if (signal?.aborted) throw new Error('aborted')
    const params = new URLSearchParams()
    if (filter?.projectPath) params.set('project', filter.projectPath)
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
  serversRef.current = servers

  const [progress, setProgress] = useState<EagerConversationsProgress>({ loaded: 0, total: 0 })

  const queryKey = useMemo(
    () => ['conversations-eager', filter, refreshEpoch, ...displayedServerIds],
    [filter, refreshEpoch, displayedServerIds],
  )

  const query = useQuery<MultiConversation[], Error>({
    queryKey,
    queryFn: async ({ signal }) => {
      setProgress({ loaded: 0, total: 0 })
      const merged: MultiConversation[] = []
      let runningLoaded = 0
      let runningTotal = 0

      for (const serverId of displayedServerIds) {
        const label = serversRef.current[serverId]?.label
        const baselineLoaded = runningLoaded
        const baselineTotal = runningTotal
        const items = await fetchAllConversationPagesForServer(
          serverId,
          label,
          filter,
          refreshEpoch,
          (loadedSoFar, totalSoFar) => {
            setProgress({
              loaded: baselineLoaded + loadedSoFar,
              total: baselineTotal + totalSoFar,
            })
          },
          signal,
        )
        runningLoaded += items.length
        runningTotal += items.length
        merged.push(...items)
      }

      merged.sort(sortByLastMessageDesc)
      return dedupeByServerAndId(merged)
    },
    enabled: displayedServerIds.length > 0,
    // Conversations rarely change minute-to-minute; list is augmented by WS
    // session_update for live status. Avoid re-paginating on every focus.
    staleTime: 60_000,
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

  return useQuery({
    queryKey: ['conversations', 'search', query, ...displayedServerIds],
    queryFn: async () => {
      const results = await Promise.all(
        displayedServerIds.map(async (serverId) => {
          const api = createApiForServer(serverId)
          const raw = await api.get<RawSessionMeta[]>(`/api/search?q=${encodeURIComponent(query)}&limit=50`)
          return { serverId, page: adaptPage(raw, 0, 50) }
        })
      )

      const merged: MultiConversation[] = []
      for (const { serverId, page } of results) {
        const label = servers[serverId]?.label
        for (const conv of page.conversations) {
          merged.push({ ...conv, serverId, serverLabel: label })
        }
      }

      merged.sort(sortByLastMessageDesc)
      const deduped = dedupeByServerAndId(merged)

      return { conversations: deduped, hasMore: false, offset: 0, total: deduped.length }
    },
    enabled: query.length > 0 && displayedServerIds.length > 0,
  })
}
