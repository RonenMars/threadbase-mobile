import { useInfiniteQuery } from '@tanstack/react-query'
import { createApiForServer } from '@/services/api-client'
import { isSubagentPageSupported } from '@/lib/subagents'
import type { Conversation, ConversationPage } from '@/types/api'

const LIMIT = 50
export const SUBAGENT_POLL_MS = 5000

interface SubagentPage {
  items: Conversation[]
  hasMore: boolean
  unsupported: boolean
}

/**
 * A parent's sub-agent transcripts, fetched only once `enabled` (the user
 * expanded the parent). Cached per server+parent; `refetch` serves
 * pull-to-refresh. A streamer that ignores `?parent=` yields `unsupported`
 * and no items rather than the unrelated list it returned.
 */
export function useSubagents(serverId: string, parentId: string, opts?: { enabled?: boolean }) {
  const query = useInfiniteQuery({
    queryKey: ['subagents', serverId, parentId] as const,
    queryFn: async ({ pageParam = 0, signal }): Promise<SubagentPage> => {
      const api = createApiForServer(serverId)
      const raw = await api.get<ConversationPage | Conversation[]>(
        `/api/conversations?parent=${encodeURIComponent(parentId)}&limit=${LIMIT}&offset=${pageParam}`,
        { signal },
      )
      const rows = (Array.isArray(raw) ? raw : (raw?.conversations ?? [])).filter(
        (r): r is Conversation => r != null,
      )
      if (!isSubagentPageSupported(rows, parentId)) {
        return { items: [], hasMore: false, unsupported: true }
      }
      return { items: rows, hasMore: Array.isArray(raw) ? false : Boolean(raw.hasMore), unsupported: false }
    },
    getNextPageParam: (last, all) =>
      last.hasMore ? all.reduce((n, p) => n + p.items.length, 0) : undefined,
    initialPageParam: 0,
    enabled: (opts?.enabled ?? true) && !!serverId && !!parentId,
    // Poll only while a loaded child is still running; an idle parent costs nothing.
    refetchInterval: (q) =>
      q.state.data?.pages.some((p) => p.items.some((c) => c.subagentActive === true)) ? SUBAGENT_POLL_MS : false,
  })

  const pages = query.data?.pages ?? []
  const unsupported = pages.some((p) => p.unsupported)
  return {
    items: unsupported ? [] : pages.flatMap((p) => p.items),
    isLoading: query.isLoading,
    unsupported,
    isError: query.isError,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    refetch: query.refetch,
  }
}
