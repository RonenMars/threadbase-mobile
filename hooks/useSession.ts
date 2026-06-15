import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createApiForServer } from '@/services/api-client'
import { useServersStore } from '@/stores/servers'
import { serverDisplayName } from '@/components/sessions/shared/serverDisplayName'
import type {
  MultiSession,
  Session,
  SessionFilter,
  SessionListPage,
  SessionStatus,
  SessionSortKeyWire,
} from '@/types/api'
import type { SortBy, SortOrder } from '@/types/ui'

const DEFAULT_PAGE_SIZE = 200

// The home screen's `SortBy` (UI) uses 'lastActivity'; the wire format is
// 'lastActivityAt' to match the field on SessionResponse. All other names
// happen to line up.
function toWireSortKey(s: SortBy): SessionSortKeyWire {
  return s === 'lastActivity' ? 'lastActivityAt' : s
}

function buildSessionsQueryString(opts: {
  limit: number
  cursor?: string
  sortBy: SessionSortKeyWire
  order: SortOrder
  status?: SessionStatus[]
}): string {
  const params = new URLSearchParams()
  params.set('limit', String(opts.limit))
  if (opts.cursor) params.set('cursor', opts.cursor)
  params.set('sortBy', opts.sortBy)
  params.set('order', opts.order)
  if (opts.status?.length) params.set('status', opts.status.join(','))
  return params.toString()
}

// Defensive: backend can occasionally return the same session twice across
// refetches in flight. Keep first occurrence so FlatList keys stay unique.
function dedupeByServerAndId(items: MultiSession[]): MultiSession[] {
  const seen = new Set<string>()
  const out: MultiSession[] = []
  for (const item of items) {
    const key = `${item.serverId}::${item.id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

// Drains a single server's pages sequentially, calling onProgress as each page
// arrives so the UI can update its loaded/total counters live.
async function fetchAllPagesForServer(
  serverId: string,
  serverLabel: string | undefined,
  sortBy: SessionSortKeyWire,
  order: SortOrder,
  status: SessionStatus[] | undefined,
  onProgress: (loadedSoFar: number, total: number) => void,
  signal?: AbortSignal,
): Promise<MultiSession[]> {
  const api = createApiForServer(serverId)
  const collected: MultiSession[] = []
  let cursor: string | undefined

  while (true) {
    if (signal?.aborted) throw new Error('aborted')
    const qs = buildSessionsQueryString({ limit: DEFAULT_PAGE_SIZE, cursor, sortBy, order, status })
    const page = await api.get<SessionListPage>(`/api/sessions?${qs}`, { signal })
    for (const s of page.sessions) {
      collected.push({ ...s, serverId, serverLabel })
    }
    onProgress(collected.length, page.total)
    if (!page.nextCursor) break
    cursor = page.nextCursor
  }

  return collected
}

export interface SessionsLoadingProgress {
  loaded: number
  total: number
  currentServerId: string | null
  currentServerLabel: string | null
}

export interface UseEagerSessionsArgs {
  sort?: { sortBy: SortBy; order: SortOrder }
  filter?: SessionFilter
}

export interface UseEagerSessionsResult {
  sessions: MultiSession[]
  loaded: number
  total: number
  isDone: boolean
  isCounting: boolean
  currentServerLabel: string | null
  currentServerId: string | null
  error: Error | null
  refetch: () => Promise<void>
}

export function useEagerSessions(args: UseEagerSessionsArgs = {}): UseEagerSessionsResult {
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const servers = useServersStore((s) => s.servers)

  const sortBy: SortBy = args.sort?.sortBy ?? 'lastActivity'
  const order: SortOrder = args.sort?.order ?? 'desc'
  const status = args.filter?.status

  const wireSortBy = toWireSortKey(sortBy)
  // Stable string key for memoisation/queryKey use (status array order matters
  // for cache identity but not for server semantics).
  const statusKey = status?.length ? [...status].sort().join(',') : ''

  const [progress, setProgress] = useState<SessionsLoadingProgress>({
    loaded: 0,
    total: 0,
    currentServerId: null,
    currentServerLabel: null,
  })

  // Keep the latest server labels accessible inside the queryFn (which closes
  // over a snapshot) without re-running on every label change.
  const serversRef = useRef(servers)
  useEffect(() => {
    serversRef.current = servers
  }, [servers])

  const queryKey = useMemo(
    () => ['sessions-eager', wireSortBy, order, statusKey, ...activeServerIds],
    [wireSortBy, order, statusKey, activeServerIds],
  )

  const query = useQuery<MultiSession[], Error>({
    queryKey,
    queryFn: async ({ signal }) => {
      // Reset progress at the start of every run so the overlay restarts cleanly.
      setProgress({ loaded: 0, total: 0, currentServerId: null, currentServerLabel: null })

      const merged: MultiSession[] = []
      let runningTotalSoFar = 0
      let runningLoadedSoFar = 0

      for (const serverId of activeServerIds) {
        const server = serversRef.current[serverId]
        // Bug 28: when the user hasn't named the server (paired pre-Feature-23
        // or tapped Skip), fall back to host:port so the progress modal still
        // says *which* server it's fetching.
        const displayLabel = serverDisplayName(server) || null
        const label = server?.label
        setProgress((p) => ({
          loaded: runningLoadedSoFar,
          total: p.total,
          currentServerId: serverId,
          currentServerLabel: displayLabel,
        }))

        // Snapshot the running counters at the moment we kick off this
        // server's pages. Closures over the live mutable counters would race
        // against the post-loop increment when React applies the state update.
        const baselineLoaded = runningLoadedSoFar
        const baselineTotal = runningTotalSoFar
        let serverSessions: MultiSession[] = []
        try {
          serverSessions = await fetchAllPagesForServer(
            serverId,
            label,
            wireSortBy,
            order,
            status,
            (loadedSoFarOnThisServer, totalOnThisServer) => {
              const globalLoaded = baselineLoaded + loadedSoFarOnThisServer
              const globalTotal = baselineTotal + totalOnThisServer
              setProgress({
                loaded: globalLoaded,
                total: globalTotal,
                currentServerId: serverId,
                currentServerLabel: displayLabel,
              })
            },
            signal,
          )
        } catch (err) {
          // If the caller cancelled the query (unmount / refetch), propagate the
          // abort so React Query can mark the query as cancelled rather than
          // silently swallowing it. Any other per-server error is isolated: the
          // remaining servers still contribute their sessions.
          if (signal?.aborted) throw err
        }

        // Roll this server's contribution into the running counters once it finishes.
        runningLoadedSoFar += serverSessions.length
        runningTotalSoFar += serverSessions.length
        merged.push(...serverSessions)
      }

      return dedupeByServerAndId(merged)
    },
    enabled: activeServerIds.length > 0,
    // Live updates arrive via WS session_update; the HTTP eager paginate
    // is only needed on cold start, manual pull-to-refresh, or after the
    // sessions list has actually drifted. 60s prevents a focus storm.
    staleTime: 60_000,
  })

  const refetch = useCallback(async () => {
    await query.refetch()
  }, [query])

  // Reset visible progress to "done" when there are no servers (avoids
  // leftover overlay state if the user removes their last server).
  useEffect(() => {
    if (activeServerIds.length === 0) {
      queueMicrotask(() => {
        setProgress({ loaded: 0, total: 0, currentServerId: null, currentServerLabel: null })
      })
    }
  }, [activeServerIds.length])

  const sessions = query.data ?? []
  const isDone =
    activeServerIds.length === 0 || (query.isFetched && !query.isFetching)
  // "Counting" = we've kicked off the loop but the first page (which carries
  // total) for the current server hasn't returned yet.
  const isCounting = !isDone && progress.total === 0 && progress.currentServerId !== null

  return {
    sessions,
    loaded: progress.loaded,
    total: progress.total,
    isDone,
    isCounting,
    currentServerLabel: progress.currentServerLabel,
    currentServerId: progress.currentServerId,
    error: query.error,
    refetch,
  }
}

// Single-server fetch used by browse.tsx. Now goes through the same paginated
// transport but eagerly drains all pages so the screen sees a complete list,
// matching its prior behaviour.
export function useSessions() {
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const servers = useServersStore((s) => s.servers)

  return useQuery<MultiSession[], Error>({
    queryKey: ['sessions', ...activeServerIds],
    queryFn: async ({ signal }) => {
      const merged: MultiSession[] = []
      for (const serverId of activeServerIds) {
        const label = servers[serverId]?.label
        const items = await fetchAllPagesForServer(
          serverId,
          label,
          'startedAt',
          'desc',
          undefined,
          () => {
            /* progress not surfaced through useSessions */
          },
          signal,
        )
        merged.push(...items)
      }
      return dedupeByServerAndId(merged)
    },
    enabled: activeServerIds.length > 0,
    staleTime: 60_000,
  })
}

export function useSessionDetail(serverId: string, sessionId: string) {
  const api = createApiForServer(serverId)
  return useQuery({
    queryKey: ['session', serverId, sessionId],
    queryFn: () => api.get<Session>(`/api/sessions/${sessionId}`),
    // WS session_update events keep this data fresh via setQueryData — no need
    // to poll or aggressively refetch. staleTime prevents a background refetch
    // from clobbering a running→waiting_input transition that already arrived
    // over WS before the HTTP response completed.
    staleTime: 30_000,
    // Don't persist session detail across app restarts — each session is
    // ephemeral and stale persisted state causes false status flickers.
    meta: { persist: false },
  })
}
