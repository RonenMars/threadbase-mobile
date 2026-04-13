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

function adaptPage(raw: RawSessionMeta[], offset: number, limit: number): ConversationPage {
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
interface RawMessage {
  role: string
  timestamp: string
  text: string
  tool_calls?: string[]
  model?: string
}

interface RawConversationDetail {
  meta: RawSessionMeta
  messages: RawMessage[]
}

function adaptDetail(raw: RawConversationDetail): ConversationDetail {
  const rawMessages = raw.messages ?? []
  const messages: import('@/types/api').Message[] = rawMessages.map((m, i) => {
    const content: import('@/types/api').MessageContent[] = []
    if (m.text) content.push({ type: 'text', text: m.text })
    if (m.tool_calls) {
      m.tool_calls.forEach((name) =>
        content.push({ type: 'tool_use', name, input: {} })
      )
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
