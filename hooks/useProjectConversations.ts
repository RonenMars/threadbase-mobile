import { useInfiniteQuery } from '@tanstack/react-query'
import { createApiForServer } from '@/services/api-client'
import type { ConversationPage, MultiConversation } from '@/types/api'

const LIMIT = 50

export interface UseProjectConversationsResult {
  conversations: MultiConversation[]
  isLoading: boolean
  isFetching: boolean
  fetchNextPage: () => void
  hasNextPage: boolean
  refresh: () => Promise<void>
}

export function useProjectConversations(
  projectPath: string,
  serverId: string,
  serverLabel?: string,
): UseProjectConversationsResult {
  const query = useInfiniteQuery({
    queryKey: ['project-conversations', serverId, projectPath] as const,
    queryFn: async ({ pageParam = 0, signal }) => {
      const api = createApiForServer(serverId)
      const encodedPath = encodeURIComponent(projectPath)
      return api.get<ConversationPage>(
        `/api/conversations?project=${encodedPath}&limit=${LIMIT}&offset=${pageParam}`,
        { signal },
      )
    },
    getNextPageParam: (lastPage, allPages) => {
      const fetched = allPages.reduce((n, p) => n + p.conversations.length, 0)
      return fetched < lastPage.total ? fetched : undefined
    },
    initialPageParam: 0,
    enabled: !!serverId && !!projectPath,
  })

  const conversations: MultiConversation[] = (query.data?.pages ?? []).flatMap((p) =>
    p.conversations.map((c) => ({ ...c, serverId, serverLabel })),
  )

  return {
    conversations,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    refresh: () => query.refetch().then(() => undefined),
  }
}
