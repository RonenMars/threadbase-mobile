import { useInfiniteQuery } from '@tanstack/react-query'
import { createApiForServer } from '@/services/api-client'
import { useServersStore } from '@/stores/servers'
import type { ConversationPage, MultiConversation } from '@/types/api'

const LIMIT = 50

export interface UseProjectConversationsResult {
  conversations: MultiConversation[]
  total: number
  isLoading: boolean
  isFetching: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  hasNextPage: boolean
  refresh: () => Promise<void>
}

/** One project's conversations, paged on demand.
 *
 *  Also the expand-to-load unit for the grouped views (ADR 0001 step 2): the
 *  tree and hub render their structure from /api/projects/summary and mount
 *  this with `enabled` only once a project is opened, so a server's
 *  conversations are never drained up front. */
export function useProjectConversations(
  projectPath: string,
  serverId: string,
  serverLabel?: string,
  opts?: { enabled?: boolean },
): UseProjectConversationsResult {
  // Callers that only hold a serverId (tree drill, hub card) can omit the
  // label rather than plumbing it through the group shape.
  const storeLabel = useServersStore((s) => s.servers[serverId]?.label)
  const label = serverLabel ?? storeLabel

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
    enabled: (opts?.enabled ?? true) && !!serverId && !!projectPath,
  })

  const conversations: MultiConversation[] = (query.data?.pages ?? []).flatMap((p) =>
    p.conversations.map((c) => ({ ...c, serverId, serverLabel: label })),
  )

  return {
    conversations,
    total: query.data?.pages[0]?.total ?? 0,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    refresh: () => query.refetch().then(() => undefined),
  }
}
