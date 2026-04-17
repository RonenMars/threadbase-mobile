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

export function useConversations(filter?: ConversationFilter) {
  const limit = 50
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const servers = useServersStore((s) => s.servers)

  return useInfiniteQuery({
    queryKey: ['conversations', filter, ...activeServerIds],
    queryFn: async ({ pageParam = 0 }): Promise<MultiConversationPage> => {
      const results = await Promise.all(
        activeServerIds.map(async (serverId) => {
          const api = createApiForServer(serverId)
          const params = new URLSearchParams()
          if (filter?.projectPath) params.set('project', filter.projectPath)
          if (filter?.dateFrom) params.set('dateFrom', filter.dateFrom)
          if (filter?.dateTo) params.set('dateTo', filter.dateTo)
          if (filter?.profileId) params.set('profileId', filter.profileId)
          params.set('limit', String(limit))
          const raw = await api.get<RawSessionMeta[]>(`/api/conversations?${params.toString()}`)
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

      // Sort by lastActivity descending
      merged.sort((a, b) => {
        const ta = a.lastActivity ? new Date(a.lastActivity).getTime() : 0
        const tb = b.lastActivity ? new Date(b.lastActivity).getTime() : 0
        return tb - ta
      })

      return { conversations: merged, hasMore: anyHasMore }
    },
    getNextPageParam: (last: MultiConversationPage, _allPages, lastPageParam) =>
      last.hasMore ? (lastPageParam as number) + limit : undefined,
    initialPageParam: 0,
    enabled: activeServerIds.length > 0,
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
  role: string
  timestamp: string
  text: string
  tool_calls?: string[]
  content?: RawContentBlock[]
  model?: string
}

interface RawConversationDetail {
  meta: RawSessionMeta
  messages: RawMessage[]
}

// Resolve a tool name from tool_use_id by looking at sibling content blocks.
function resolveToolName(toolUseId: string | undefined, blocks: RawContentBlock[] | undefined): string {
  if (!toolUseId || !blocks) return 'Tool'
  const match = blocks.find((b) => b.type === 'tool_use' && b.id === toolUseId)
  return match?.name ?? 'Tool'
}

function adaptDetail(raw: RawConversationDetail): ConversationDetail {
  const rawMessages = raw.messages ?? []
  const messages: Message[] = rawMessages.map((m, i) => {
    const content: MessageContent[] = []

    if (m.content && m.content.length > 0) {
      // Use the rich content blocks from the server
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
      // Fallback for older server responses without content blocks
      if (m.text) content.push({ type: 'text', text: m.text })
      if (m.tool_calls) {
        m.tool_calls.forEach((name) =>
          content.push({ type: 'tool_use', name, input: {} })
        )
      }
    }

    return {
      id: `${raw.meta.id}-${i}`,
      role: m.role as 'user' | 'assistant',
      content,
      timestamp: m.timestamp,
    }
  })

  return {
    id: raw.meta.id,
    title: raw.meta.project_name ?? 'Conversation',
    projectPath: raw.meta.project_path ?? '',
    branch: raw.meta.git_branch,
    messageCount: rawMessages.length,
    lastActivity: raw.meta.last_updated_at ?? '',
    messages,
  }
}

export function useConversation(serverId: string, id: string) {
  const api = createApiForServer(serverId)
  return useQuery({
    queryKey: ['conversation', serverId, id],
    queryFn: async () => {
      const raw = await api.get<RawConversationDetail>(`/api/conversations/${id}`)
      return adaptDetail(raw)
    },
  })
}

export function useConversationSearch(query: string) {
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const servers = useServersStore((s) => s.servers)

  return useQuery({
    queryKey: ['conversations', 'search', query, ...activeServerIds],
    queryFn: async () => {
      const results = await Promise.all(
        activeServerIds.map(async (serverId) => {
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

      merged.sort((a, b) => {
        const ta = a.lastActivity ? new Date(a.lastActivity).getTime() : 0
        const tb = b.lastActivity ? new Date(b.lastActivity).getTime() : 0
        return tb - ta
      })

      return { conversations: merged, hasMore: false, offset: 0, total: merged.length }
    },
    enabled: query.length > 0 && activeServerIds.length > 0,
  })
}
