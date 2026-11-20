import { useInfiniteQuery, useQuery, type QueryClient } from '@tanstack/react-query'
import { createApiForServer } from '@/services/api-client'
import { isSubagentPageSupported } from '@/lib/subagents'
import type { Conversation, ConversationPage } from '@/types/api'

const LIMIT = 50
export const SUBAGENT_POLL_MS = 5000
// Backstop for the count only: the `subagents_changed` frame is the fast path,
// this heals a frame a backgrounded socket missed and an older streamer.
export const SUBAGENT_COUNT_POLL_MS = 15000

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

/**
 * Live sub-agent count for the header, independent of expansion. The streamer
 * pushes `subagents_changed` (full total, never a delta); polling `?parent=`
 * with `limit=1` backs it up. `null` = unknown or unsupported by the streamer.
 */
export function useSubagentCount(serverId: string, parentId: string): number | null {
  const { data } = useQuery({
    queryKey: ['subagent-count', serverId, parentId] as const,
    queryFn: async ({ signal }): Promise<number | null> => {
      const raw = await createApiForServer(serverId).get<ConversationPage | Conversation[]>(
        `/api/conversations?parent=${encodeURIComponent(parentId)}&limit=1`,
        { signal },
      )
      if (Array.isArray(raw) || typeof raw?.total !== 'number') return null
      return isSubagentPageSupported((raw.conversations ?? []).filter(Boolean), parentId) ? raw.total : null
    },
    enabled: !!serverId && !!parentId,
    refetchInterval: SUBAGENT_COUNT_POLL_MS,
  })

  return data ?? null
}

/** Apply a `subagents_changed` frame: existing queries only, so an unmounted parent costs nothing. */
export function applySubagentsChanged(qc: QueryClient, serverId: string, parentId: string, total: number) {
  qc.setQueriesData({ queryKey: ['subagent-count', serverId, parentId] }, total)
  // Only refetches the list if it is mounted, i.e. the section is expanded.
  void qc.invalidateQueries({ queryKey: ['subagents', serverId, parentId] })
}
