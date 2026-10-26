import { useQueries } from '@tanstack/react-query'
import { createApiForServer } from '@/services/api-client'
import { isAllSubagentsPageSupported } from '@/lib/subagents'
import type { Conversation, ConversationPage } from '@/types/api'

const LIMIT = 100

export interface BoardSubagent {
  serverId: string
  conversation: Conversation
}

/**
 * Every sub-agent on each server, for the board. One page per server; the
 * board is a recency view, not an archive. A server that ignores
 * `?include=subagents` is reported in `unsupportedServerIds` with no rows.
 */
export function useAllSubagents(serverIds: readonly string[], opts?: { enabled?: boolean }) {
  const results = useQueries({
    queries: serverIds.map((serverId) => ({
      queryKey: ['subagents-board', serverId] as const,
      enabled: opts?.enabled ?? true,
      queryFn: async ({ signal }: { signal?: AbortSignal }) => {
        const api = createApiForServer(serverId)
        const raw = await api.get<ConversationPage | Conversation[]>(
          `/api/conversations?include=subagents&limit=${LIMIT}`,
          { signal },
        )
        const rows = (Array.isArray(raw) ? raw : (raw?.conversations ?? [])).filter(
          (r): r is Conversation => r != null,
        )
        return isAllSubagentsPageSupported(rows)
          ? { rows, unsupported: false }
          : { rows: [] as Conversation[], unsupported: true }
      },
    })),
  })

  const items: BoardSubagent[] = results.flatMap((r, i) =>
    (r.data?.rows ?? []).map((conversation) => ({ serverId: serverIds[i], conversation })),
  )
  const unsupportedServerIds = serverIds.filter((_, i) => results[i].data?.unsupported === true)
  return {
    items,
    unsupportedServerIds,
    isLoading: results.some((r) => r.isLoading),
    isError: results.length > 0 && results.every((r) => r.isError),
    refetch: () => Promise.all(results.map((r) => r.refetch())),
  }
}
