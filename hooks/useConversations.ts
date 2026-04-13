import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { api } from '@/services/api-client'
import type {
  ConversationDetail,
  ConversationFilter,
  ConversationPage,
  Message,
  MessageContent,
} from '@/types/api'

// Shape returned by the CLI server at GET /api/conversations/:id
// (serializes domain.Session directly). We normalize it here into
// ConversationDetail so the UI can stay uniform.
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

interface RawMessage {
  role: 'user' | 'assistant'
  timestamp?: string
  text?: string
  tool_calls?: string[]
  model?: string
}

interface RawSession {
  meta: RawSessionMeta
  messages: RawMessage[]
}

function normalizeMessage(raw: RawMessage, index: number): Message {
  const content: MessageContent[] = []
  if (raw.text && raw.text.length > 0) {
    content.push({ type: 'text', text: raw.text })
  }
  for (const name of raw.tool_calls ?? []) {
    content.push({ type: 'tool_use', name, input: {} })
  }
  return {
    id: `${raw.timestamp ?? 'msg'}-${index}`,
    role: raw.role,
    content,
    timestamp: raw.timestamp ?? '',
  }
}

function normalizeConversation(raw: RawSession): ConversationDetail {
  const meta = raw.meta ?? ({} as RawSessionMeta)
  const title =
    (meta.preview && meta.preview.trim()) ||
    meta.project_name ||
    'Conversation'
  return {
    id: meta.id,
    title,
    projectPath: meta.project_path ?? '',
    branch: meta.git_branch,
    messageCount: meta.message_count ?? raw.messages?.length ?? 0,
    lastActivity: meta.last_updated_at ?? '',
    messages: (raw.messages ?? []).map(normalizeMessage),
  }
}

export function useConversations(filter?: ConversationFilter) {
  const params = new URLSearchParams()
  if (filter?.projectPath) params.set('projectPath', filter.projectPath)
  if (filter?.dateFrom) params.set('dateFrom', filter.dateFrom)
  if (filter?.dateTo) params.set(filter.dateTo, filter.dateTo)
  if (filter?.profileId) params.set('profileId', filter.profileId)

  return useInfiniteQuery({
    queryKey: ['conversations', filter],
    queryFn: ({ pageParam = 0 }) => {
      params.set('offset', String(pageParam))
      params.set('limit', '50')
      return api.get<ConversationPage>(`/api/conversations?${params.toString()}`)
    },
    getNextPageParam: (last: ConversationPage) =>
      last.hasMore ? last.offset + 50 : undefined,
    initialPageParam: 0,
  })
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: ['conversation', id],
    queryFn: async () => {
      const raw = await api.get<RawSession>(`/api/conversations/${id}`)
      return normalizeConversation(raw)
    },
  })
}

export function useConversationSearch(query: string) {
  return useQuery({
    queryKey: ['conversations', 'search', query],
    queryFn: () =>
      api.get<ConversationPage>(`/api/search?q=${encodeURIComponent(query)}&limit=50`),
    enabled: query.length > 0,
  })
}
