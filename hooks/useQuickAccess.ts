import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import { createApiForServer } from '@/services/api-client'
import { clientLog } from '@/lib/clientLog'
import type { MultiPopularProject, MultiSession, PopularProject } from '@/types/api'

type RecentsResponse = { sessions: MultiSession[]; total: number }
type PopularResponse = { projects: MultiPopularProject[]; total: number }

type AggregateStatus = 'pending' | 'success' | 'error'

type AggregateResult<T> = {
  data: T
  status: AggregateStatus
  fetchStatus: 'fetching' | 'idle'
  error: unknown
  refetch: () => void
  /** Per-server error count, useful for partial-failure UI. */
  perServerErrors: number
}

/**
 * Spawns one query per server in `serverIds`, returning sessions merged across
 * all servers. Each session is tagged with the `serverId` it came from so
 * downstream code can route taps back to the right server.
 *
 * The aggregate `status` follows union semantics:
 *  - 'pending' if every query is still pending
 *  - 'success' if at least one query succeeded
 *  - 'error'   if every query errored
 */
export function useRecentSessions(serverIds: string[], limit = 20): AggregateResult<RecentsResponse> {
  const queries = useQueries({
    queries: serverIds.map((serverId) => ({
      queryKey: ['quick-access-recents', serverId, limit] as const,
      queryFn: async (): Promise<RecentsResponse> => {
        clientLog.info('hook.useRecentSessions', 'queryFn START', { serverId })
        try {
          const r = await createApiForServer(serverId).get<RecentsResponse>(
            `/api/sessions/recents?limit=${limit}`,
          )
          // Tag every session with its serverId so the merged list keeps the origin.
          const tagged: RecentsResponse = {
            ...r,
            sessions: (r.sessions ?? []).map((s) => ({ ...s, serverId })),
          }
          clientLog.info('hook.useRecentSessions', 'queryFn OK', {
            serverId, sessions: tagged.sessions.length,
          })
          return tagged
        } catch (e) {
          clientLog.error('hook.useRecentSessions', 'queryFn ERROR', {
            serverId,
            error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
          })
          throw e
        }
      },
      staleTime: 30_000,
      enabled: !!serverId,
    })),
  })

  return useMemo(() => aggregateRecents(queries), [queries])
}

export function usePopularProjects(serverIds: string[], limit = 20): AggregateResult<PopularResponse> {
  const queries = useQueries({
    queries: serverIds.map((serverId) => ({
      queryKey: ['quick-access-popular', serverId, limit] as const,
      queryFn: async (): Promise<PopularResponse> => {
        clientLog.info('hook.usePopularProjects', 'queryFn START', { serverId })
        try {
          const r = await createApiForServer(serverId).get<{ projects: PopularProject[]; total: number }>(
            `/api/projects/popular?limit=${limit}`,
          )
          // Tag every project with its serverId so the merged list keeps the
          // origin. Without this, downstream taps (Popular → "New Session
          // here") fall back to `queriedServerIds[0]` and may hit the wrong
          // server's `/api/browse`, surfacing "Unable to load directories"
          // even when the originating server is reachable. (Bug 23.)
          const tagged: PopularResponse = {
            ...r,
            projects: (r.projects ?? []).map((p) => ({ ...p, serverId })),
          }
          clientLog.info('hook.usePopularProjects', 'queryFn OK', {
            serverId, projects: tagged.projects.length,
          })
          return tagged
        } catch (e) {
          clientLog.error('hook.usePopularProjects', 'queryFn ERROR', {
            serverId,
            error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
          })
          throw e
        }
      },
      staleTime: 5 * 60_000,
      enabled: !!serverId,
    })),
  })

  return useMemo(() => aggregatePopular(queries), [queries])
}

type QueryLike<T> = {
  data: T | undefined
  status: AggregateStatus
  fetchStatus: 'fetching' | 'paused' | 'idle'
  error: unknown
  refetch: () => void
}

function aggregateStatus(queries: QueryLike<unknown>[]): AggregateStatus {
  if (queries.length === 0) return 'success'
  if (queries.some((q) => q.status === 'success')) return 'success'
  if (queries.every((q) => q.status === 'error')) return 'error'
  return 'pending'
}

function aggregateFetchStatus(queries: QueryLike<unknown>[]): 'fetching' | 'idle' {
  return queries.some((q) => q.fetchStatus === 'fetching') ? 'fetching' : 'idle'
}

function makeRefetch(queries: QueryLike<unknown>[]): () => void {
  return () => queries.forEach((q) => q.refetch())
}

function aggregateRecents(queries: QueryLike<RecentsResponse>[]): AggregateResult<RecentsResponse> {
  const successful = queries.filter((q) => q.status === 'success' && q.data)
  const merged = successful.flatMap((q) => q.data!.sessions)
  // Newest first. The streamer sets `startedAt` to the conversation's last activity
  // for this endpoint, so it's the right sort key for unioning across servers.
  merged.sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))

  return {
    data: { sessions: merged, total: merged.length },
    status: aggregateStatus(queries),
    fetchStatus: aggregateFetchStatus(queries),
    error: queries.find((q) => q.error)?.error ?? null,
    refetch: makeRefetch(queries),
    perServerErrors: queries.filter((q) => q.status === 'error').length,
  }
}

function aggregatePopular(queries: QueryLike<PopularResponse>[]): AggregateResult<PopularResponse> {
  const successful = queries.filter((q) => q.status === 'success' && q.data)
  const merged = successful.flatMap((q) => q.data!.projects)
  // Same path can appear on multiple servers — keep the highest-count
  // occurrence. The retained entry's `serverId` carries through, so taps on
  // this chip route back to the server that actually has that many sessions.
  const byPath = new Map<string, MultiPopularProject>()
  for (const p of merged) {
    const existing = byPath.get(p.path)
    if (!existing || p.sessionCount > existing.sessionCount) byPath.set(p.path, p)
  }
  const dedup = Array.from(byPath.values()).sort((a, b) => b.sessionCount - a.sessionCount)

  return {
    data: { projects: dedup, total: dedup.length },
    status: aggregateStatus(queries),
    fetchStatus: aggregateFetchStatus(queries),
    error: queries.find((q) => q.error)?.error ?? null,
    refetch: makeRefetch(queries),
    perServerErrors: queries.filter((q) => q.status === 'error').length,
  }
}
