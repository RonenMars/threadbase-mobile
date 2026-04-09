import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { api } from '@/services/api-client'
import type { ConversationDetail, ConversationFilter, ConversationPage } from '@/types/api'

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
    queryFn: () => api.get<ConversationDetail>(`/api/conversations/${id}`),
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
