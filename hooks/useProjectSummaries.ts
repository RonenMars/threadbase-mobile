import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getServerWarmupState } from '@/services/server-warmup'
import { listProjectSummaries, type ProjectSummary } from '@/services/projects-api'
import { QUERY_GC_TIME } from '@/services/query-client'
import { useServersStore } from '@/stores/servers'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'

/** A project summary tagged with the server it came from. Groups in the tree
 *  and hub are keyed by (serverId, path), so the pair travels together. */
export interface MultiProjectSummary extends ProjectSummary {
  serverId: string
  serverLabel?: string
}

// One page covers a typical server outright (93 projects on the reference
// host), so this drains rather than paginating — the page count is bounded by
// project count, not conversation count, which is the whole point of the
// endpoint. A 1000-project server costs 5 requests; the eager conversation
// drain it replaces cost 13 for ONE server's conversations alone.
const PAGE_LIMIT = 200

async function fetchAllSummariesForServer(
  serverId: string,
  signal?: AbortSignal,
): Promise<ProjectSummary[]> {
  const collected: ProjectSummary[] = []
  let offset = 0
  for (;;) {
    const page = await listProjectSummaries(serverId, PAGE_LIMIT, offset, signal)
    collected.push(...page.projects)
    if (!page.hasMore || page.projects.length === 0) return collected
    offset += page.projects.length
  }
}

export interface UseProjectSummariesResult {
  summaries: MultiProjectSummary[]
  /** Servers running a streamer without /api/projects/summary. The grouped
   *  views cannot be built for these, so the caller renders an upgrade state
   *  rather than an empty — and therefore lying — tree. */
  unsupportedServerIds: string[]
  isLoading: boolean
  isFetching: boolean
  error: Error | null
}

export function useProjectSummaries(
  refreshEpoch = 0,
  opts?: { enabled?: boolean },
): UseProjectSummariesResult {
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const servers = useServersStore((s) => s.servers)

  const recordSuccess = useServerFetchStatusStore((s) => s.recordSuccess)
  const recordFailure = useServerFetchStatusStore((s) => s.recordFailure)
  const recordWarmingUp = useServerFetchStatusStore((s) => s.recordWarmingUp)

  // /api/info advertises projectSummary, and that flag is the ONLY thing that
  // marks a server as too old. A bare 404 from the summary endpoint is not
  // enough: a down tunnel or a misrouted proxy 404s every path including
  // /api/info, and calling that "update your streamer" sends the user after a
  // problem they do not have. Unreachable stays unreachable; only a streamer
  // that answered /api/info *without* the flag is unsupported.
  const knownUnsupported = useMemo(
    () =>
      displayedServerIds.filter((id) => {
        const info = servers[id]?.serverInfo
        return info != null && info.projectSummary !== true
      }),
    [displayedServerIds, servers],
  )

  const query = useQuery<
    { summaries: MultiProjectSummary[]; unsupportedServerIds: string[] },
    Error
  >({
    queryKey: ['project-summaries', refreshEpoch, ...displayedServerIds],
    queryFn: async ({ signal }) => {
      const candidates = displayedServerIds.filter((id) => !knownUnsupported.includes(id))

      // allSettled so one unreachable server doesn't blank every other
      // server's groups — same stance as useConversations.
      const settled = await Promise.allSettled(
        candidates.map(async (serverId) => ({
          serverId,
          projects: await fetchAllSummariesForServer(serverId, signal),
        })),
      )

      const summaries: MultiProjectSummary[] = []
      const unsupported = [...knownUnsupported]
      const failed: string[] = []

      settled.forEach((result, idx) => {
        const serverId = candidates[idx]
        if (result.status === 'fulfilled') {
          recordSuccess(serverId)
          const serverLabel = servers[serverId]?.label
          for (const project of result.value.projects) {
            summaries.push({ ...project, serverId, serverLabel })
          }
          return
        }
        failed.push(serverId)
        const warmupState = getServerWarmupState(result.reason)
        if (warmupState) recordWarmingUp(serverId, warmupState)
        else recordFailure(serverId, result.reason)
      })

      // Every reachable server failed: surface as a query error so the caller
      // shows its existing error state instead of an empty list. Unsupported
      // servers are NOT an error — they get their own state.
      if (summaries.length === 0 && failed.length > 0 && unsupported.length === 0) {
        const firstReject = settled.find(
          (r): r is PromiseRejectedResult => r.status === 'rejected',
        )
        throw firstReject?.reason ?? new Error('All servers failed')
      }

      return { summaries, unsupportedServerIds: unsupported }
    },
    enabled: (opts?.enabled ?? true) && displayedServerIds.length > 0,
    gcTime: QUERY_GC_TIME,
  })

  const enabled = (opts?.enabled ?? true) && displayedServerIds.length > 0

  return {
    summaries: query.data?.summaries ?? [],
    unsupportedServerIds: query.data?.unsupportedServerIds ?? knownUnsupported,
    isLoading: query.isPending && enabled,
    isFetching: query.isFetching,
    error: query.error,
  }
}
