import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { api } from '@/services/api-client'
import type { Conversation, ConversationDetail, ConversationFilter, ConversationPage } from '@/types/api'

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
  const conversations: Conversation[] = raw.map((s) => ({
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

export function useConversations(filter?: ConversationFilter) {
  const limit = 50

  return useInfiniteQuery({
    queryKey: ['conversations', filter],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams()
      if (filter?.projectPath) params.set('project', filter.projectPath)
      if (filter?.profileId) params.set('profileId', filter.profileId)
      params.set('limit', String(limit))
      const raw = await api.get<RawSessionMeta[]>(`/api/conversations?${params.toString()}`)
      return adaptPage(raw, pageParam as number, limit)
    },
    getNextPageParam: (last: ConversationPage) =>
      last.hasMore ? last.offset + limit : undefined,
    initialPageParam: 0,
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
  const messages: import('@/types/api').Message[] = rawMessages.map((m, i) => {
    const content: import('@/types/api').MessageContent[] = []

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
    title: raw.meta.project_name,
    projectPath: raw.meta.project_path,
    branch: raw.meta.git_branch,
    messageCount: rawMessages.length,
    lastActivity: raw.meta.last_updated_at,
    messages,
  }
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: ['conversation', id],
    queryFn: async () => {
      const raw = await api.get<RawConversationDetail>(`/api/conversations/${id}`)
      return adaptDetail(raw)
    },
  })
}

export function useConversationSearch(query: string) {
  return useQuery({
    queryKey: ['conversations', 'search', query],
    queryFn: async () => {
      const raw = await api.get<RawSessionMeta[]>(`/api/search?q=${encodeURIComponent(query)}&limit=50`)
      return adaptPage(raw, 0, 50)
    },
    enabled: query.length > 0,
  })
}
