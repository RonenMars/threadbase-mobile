import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useThrottledCallback } from 'use-debounce'
import { narrowSessionStatus } from '@/lib/sessionPresentation'
import { createApiForServer } from '@/services/api-client'
import { getServerWarmupState } from '@/services/server-warmup'
import { useServersStore } from '@/stores/servers'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { clearOpenRefusal } from '@/services/e2ee/context'
import type {
  MultiSession,
  Session,
  SessionFilter,
  SessionListPage,
  SessionStatus,
  SessionSortKeyWire,
} from '@/types/api'
import type { SortBy, SortOrder } from '@/types/ui'

const DEFAULT_PAGE_SIZE = 50
// Initial Hub loading must fail promptly when a phone cannot reach a configured
// server. The user can explicitly retry from the non-blocking server alert.
const SESSIONS_FETCH_TIMEOUT_MS = 12_000

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
    // Do not automatically retry startup list requests: two unreachable servers
    // otherwise keep the Hub blocked for two 60-second attempts.
    const page = await api.get<SessionListPage>(`/api/sessions?${qs}`, {
      signal,
      timeoutMs: SESSIONS_FETCH_TIMEOUT_MS,
      retry: false,
    })
    for (const s of page.sessions) {
      collected.push({ ...s, status: narrowSessionStatus(s.status), serverId, serverLabel })
    }
    onProgress(collected.length, page.total)
    if (!page.nextCursor) break
    cursor = page.nextCursor
  }

  return collected
}

// Per-server slice of loading progress. `total` is null until the first page
// returns (the backend only reports the grand total on the first response).
interface ServerProgress {
  loaded: number
  total: number | null
  done: boolean
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
  inFlightCount: number
  isRetrying: boolean
  error: Error | null
  refetch: () => Promise<void>
  retryFailed: (serverIds?: string[]) => void
}

export function useEagerSessions(args: UseEagerSessionsArgs = {}): UseEagerSessionsResult {
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const servers = useServersStore((s) => s.servers)
  const recordSuccess = useServerFetchStatusStore((s) => s.recordSuccess)
  const recordFailure = useServerFetchStatusStore((s) => s.recordFailure)
  const recordWarmingUp = useServerFetchStatusStore((s) => s.recordWarmingUp)

  const sortBy: SortBy = args.sort?.sortBy ?? 'lastActivity'
  const order: SortOrder = args.sort?.order ?? 'desc'
  const status = args.filter?.status

  const wireSortBy = toWireSortKey(sortBy)
  const statusKey = status?.length ? [...status].sort().join(',') : ''
  const [fetchRequest, setFetchRequest] = useState<{
    serverIds: string[]
    retrying: boolean
    nonce: number
  } | null>(null)
  const [preservedSessions, setPreservedSessions] = useState<MultiSession[]>([])
  const targetServerIds = fetchRequest?.serverIds ?? activeServerIds

  // Per-server progress map stored in a ref so queryFn mutations don't need
  // setState on every page tick, only a single aggregate setState call.
  const serverProgressRef = useRef<Map<string, ServerProgress>>(new Map())

  // Aggregated state for the UI — updated whenever any server's slice changes.
  const [aggregateProgress, setAggregateProgress] = useState({ loaded: 0, total: 0, inFlightCount: 0 })
  // Each page of each server ticks progress; writing every tick to state
  // re-renders the whole Hub. Coalesce to ≤1 write per 250ms (flushed on
  // completion so the final counter is exact).
  const throttledSetAggregate = useThrottledCallback(setAggregateProgress, 250)

  const serversRef = useRef(servers)
  useEffect(() => {
    serversRef.current = servers
  }, [servers])

  const queryKey = useMemo(
    () => ['sessions-eager', wireSortBy, order, statusKey, ...targetServerIds, fetchRequest?.nonce ?? 0],
    [wireSortBy, order, statusKey, targetServerIds, fetchRequest?.nonce],
  )

  // Recomputes and flushes aggregate to state. Called from per-server progress
  // callbacks — runs on the JS thread between awaits so no locking needed.
  const flushAggregate = useCallback(() => {
    let loaded = 0
    let total = 0
    let inFlight = 0
    for (const slice of serverProgressRef.current.values()) {
      loaded += slice.loaded
      // Only include servers whose first page (which carries `total`) has
      // returned. Before that the denominator is unknowable for that server.
      if (slice.total !== null) total += slice.total
      if (!slice.done) inFlight++
    }
    throttledSetAggregate({ loaded, total, inFlightCount: inFlight })
  }, [throttledSetAggregate])

  const query = useQuery<MultiSession[], Error>({
    queryKey,
    queryFn: async ({ signal }) => {
      // Reset per-server slices and aggregate at the start of every run.
      const initialMap = new Map<string, ServerProgress>()
      for (const id of targetServerIds) {
        initialMap.set(id, { loaded: 0, total: null, done: false })
      }
      serverProgressRef.current = initialMap
      throttledSetAggregate.cancel()
      setAggregateProgress({ loaded: 0, total: 0, inFlightCount: targetServerIds.length })

      const perServerResults = await Promise.all(
        targetServerIds.map(async (serverId) => {
          const server = serversRef.current[serverId]
          const label = server?.label

          try {
            const sessions = await fetchAllPagesForServer(
              serverId,
              label,
              wireSortBy,
              order,
              status,
              (loadedSoFar, serverTotal) => {
                const slice = serverProgressRef.current.get(serverId)
                if (slice) {
                  slice.loaded = loadedSoFar
                  slice.total = serverTotal
                  flushAggregate()
                }
              },
              signal,
            )
            recordSuccess(serverId)
            return sessions
          } catch (err) {
            if (signal?.aborted) throw err
            const warmupState = getServerWarmupState(err)
            if (warmupState) recordWarmingUp(serverId, warmupState)
            else recordFailure(serverId, err)
            return [] as MultiSession[]
          } finally {
            const slice = serverProgressRef.current.get(serverId)
            if (slice) {
              slice.done = true
              flushAggregate()
            }
          }
        }),
      )

      // Land the final loaded/total now — a pending trailing write would
      // otherwise leave the counter one page short at "done".
      throttledSetAggregate.flush()

      const untouchedSessions = preservedSessions.filter((session) => !targetServerIds.includes(session.serverId))
      return dedupeByServerAndId([...untouchedSessions, ...perServerResults.flat()])
    },
    enabled: activeServerIds.length > 0,
  })

  const refetch = useCallback(async () => {
    setPreservedSessions(query.data ?? preservedSessions)
    setFetchRequest((previous) => ({
      serverIds: activeServerIds,
      retrying: false,
      nonce: (previous?.nonce ?? 0) + 1,
    }))
  }, [activeServerIds, preservedSessions, query.data])

  const retryFailed = useCallback((serverIds?: string[]) => {
    const failedServerIds = (serverIds ?? activeServerIds).filter(
      (serverId) => useServerFetchStatusStore.getState().statuses[serverId]?.status === 'error',
    )
    if (failedServerIds.length === 0) return
    // The user asking again is one of the few events that may forget a permanent
    // E2EE refusal. A foreground or a reconnect must not, or the storm returns.
    for (const serverId of failedServerIds) clearOpenRefusal(serverId)
    setPreservedSessions(query.data ?? preservedSessions)
    setFetchRequest((previous) => ({
      serverIds: failedServerIds,
      retrying: true,
      nonce: (previous?.nonce ?? 0) + 1,
    }))
  }, [activeServerIds, preservedSessions, query.data])

  useEffect(() => {
    if (activeServerIds.length === 0) {
      queueMicrotask(() => {
        serverProgressRef.current = new Map()
        setAggregateProgress({ loaded: 0, total: 0, inFlightCount: 0 })
      })
    }
  }, [activeServerIds.length])

  // A targeted retry uses a new query key. Keep the prior successful sessions
  // visible while that fresh query has no data yet.
  const sessions = query.data ?? preservedSessions
  const isDone = activeServerIds.length === 0 || (query.isFetched && !query.isFetching)
  // "Counting" = fetches are running but no server has returned its first page yet
  const isCounting = !isDone && aggregateProgress.total === 0 && aggregateProgress.inFlightCount > 0

  return {
    sessions,
    loaded: aggregateProgress.loaded,
    total: aggregateProgress.total,
    isDone,
    isCounting,
    inFlightCount: aggregateProgress.inFlightCount,
    isRetrying: fetchRequest?.retrying === true && query.isFetching,
    error: query.error,
    refetch,
    retryFailed,
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
  })
}

export function useSessionDetail(serverId: string, sessionId: string) {
  const api = createApiForServer(serverId)
  return useQuery({
    queryKey: ['session', serverId, sessionId],
    queryFn: async () => {
      const session = await api.get<Session>(`/api/sessions/${sessionId}`)
      return { ...session, status: narrowSessionStatus(session.status) }
    },
    // Don't persist session detail across app restarts — each session is
    // ephemeral and stale persisted state causes false status flickers.
    meta: { persist: false },
    // A vanished session is authoritative — retrying a 404 only delays the
    // not-found recovery UI and keeps stale favorites pinned longer.
    retry: false,
  })
}
