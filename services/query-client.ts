import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import { QueryClient, onlineManager, focusManager } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { AppState, type AppStateStatus } from 'react-native'
import i18n from '@/lib/i18n'
import { useLoadingStateStore, type QueryCategory } from '@/stores/loading-state'
import { useSessionsStore } from '@/stores/sessions'
import type { MultiConversation, MultiSession } from '@/types/api'

const ONE_MINUTE = 1000 * 60
export const QUERY_GC_TIME = ONE_MINUTE * 5
export const SEVEN_DAYS = 1000 * 60 * 60 * 24 * 7

// ponytail: 60 s matches the per-page fetch timeout; 20 s fired too eagerly on cold multi-server loads
const SLOW_QUERY_THRESHOLD_MS = 60000

const slowTimers = new Map<string, ReturnType<typeof setTimeout>>()

function clearSlowTimer(hash: string) {
  const t = slowTimers.get(hash)
  if (t !== undefined) {
    clearTimeout(t)
    slowTimers.delete(hash)
  }
}

function categoryForHash(hash: string): QueryCategory {
  // React Query serialises queryKey arrays as JSON: ["sessions",...] or ["session",...]
  if (/^\["sessions/.test(hash)) return 'sessions'
  if (/^\["conversations/.test(hash)) return 'conversations'
  if (/^\["conversation"/.test(hash)) return 'messages'
  if (/^\["session"/.test(hash)) return 'session-detail'
  if (/^\["browse"/.test(hash)) return 'browse'
  return 'other'
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Per-hook overrides where stronger retry semantics are warranted.
      // Default 0 keeps a 3-server, multi-page eager loop from amplifying a
      // single transient failure into 3×N×3 retried requests.
      retry: 0,
      staleTime: 0,
      gcTime: QUERY_GC_TIME,
      refetchOnReconnect: true,
    },
  },
})

interface ConversationCollection {
  conversations: MultiConversation[]
  total?: number
}

interface ConversationInfiniteData {
  pages: ConversationCollection[]
  pageParams: unknown[]
}

function withoutServer<T extends { serverId: string }>(items: T[], serverId: string): T[] {
  return items.filter((item) => item.serverId !== serverId)
}

function filterConversationCollection(
  collection: ConversationCollection,
  serverId: string,
): ConversationCollection {
  const conversations = withoutServer(collection.conversations, serverId)
  const removed = collection.conversations.length - conversations.length
  return {
    ...collection,
    conversations,
    ...(collection.total === undefined
      ? {}
      : { total: Math.max(0, collection.total - removed) }),
  }
}

/** Drop cached list/detail state belonging to one server while preserving all others. */
export function clearServerConversationAndSessionState(serverId: string) {
  queryClient.setQueriesData<MultiConversation[]>(
    { queryKey: ['conversations-eager'] },
    (data) => data ? withoutServer(data, serverId) : data,
  )
  queryClient.setQueriesData<MultiConversation[] | ConversationCollection | ConversationInfiniteData>(
    { queryKey: ['conversations'] },
    (data) => {
      if (!data) return data
      if (Array.isArray(data)) return withoutServer(data, serverId)
      if ('pages' in data) {
        return { ...data, pages: data.pages.map((page) => filterConversationCollection(page, serverId)) }
      }
      return filterConversationCollection(data, serverId)
    },
  )
  queryClient.setQueriesData<MultiSession[]>(
    { queryKey: ['sessions-eager'] },
    (data) => data ? withoutServer(data, serverId) : data,
  )
  queryClient.setQueriesData<MultiSession[]>(
    { queryKey: ['sessions'] },
    (data) => data ? withoutServer(data, serverId) : data,
  )

  queryClient.removeQueries({ queryKey: ['conversation', serverId] })
  queryClient.removeQueries({ queryKey: ['project-conversations', serverId] })
  queryClient.removeQueries({ queryKey: ['session', serverId] })
  useSessionsStore.getState().clearServer(serverId)
}

// React Native has no browser online/offline events, so onlineManager never
// learns about radio state on its own — refetchOnReconnect would never fire and
// mutations (networkMode 'online') could not detect offline. Drive it from
// NetInfo. isInternetReachable is null (unknown) on cold start; treat null as
// online so we don't falsely pause every query for the first second.
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    const online = state?.isConnected !== false && state?.isInternetReachable !== false
    const wasOnline = onlineManager.isOnline()
    setOnline(online)
    // Replay mutations that auto-paused while offline once we reconnect.
    if (online && !wasOnline) {
      queryClient.resumePausedMutations()
    }
  })
})

// AppState replaces the browser's visibilitychange so refetchOnWindowFocus
// (default true) fires when the app returns to the foreground.
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
    handleFocus(status === 'active')
  })
  return () => sub.remove()
})

queryClient.getQueryCache().subscribe((event) => {
  if (!event) return
  const { query } = event
  const hash = query.queryHash
  const category = categoryForHash(hash)
  const store = useLoadingStateStore.getState()

  if (query.state.fetchStatus === 'fetching') {
    if (!slowTimers.has(hash)) {
      const slowTimer = setTimeout(() => {
        slowTimers.delete(hash)
        store.incrementSlow(category)

        // Dismiss the moment this query stops fetching OR is removed/GC'd. The
        // removal case matters: if the query is dropped mid-fetch (unmount, key
        // change) the settle event never fires for this hash, and without this
        // the slow-count would dangle > 0 forever and freeze the overlay.
        let settled = false
        const done = () => {
          if (settled) return
          settled = true
          clearTimeout(hardTimeout)
          store.decrementSlow(category)
          unsub()
        }
        const unsub = queryClient.getQueryCache().subscribe((e) => {
          if (!e || e.query.queryHash !== hash) return
          if (e.type === 'removed' || e.query.state.fetchStatus !== 'fetching') done()
        })
        // Absolute backstop: never let a slow-count outlive the fetch by more
        // than the threshold again, regardless of what events do/don't arrive.
        const hardTimeout = setTimeout(done, SLOW_QUERY_THRESHOLD_MS)
      }, SLOW_QUERY_THRESHOLD_MS)
      slowTimers.set(hash, slowTimer)
    }
  } else {
    clearSlowTimer(hash)

    if (query.state.status === 'error') {
      const err = query.state.error
      const message = err instanceof Error ? err.message : i18n.t('common:error.unexpected')
      const status =
        err && 'status' in (err as object) ? (err as { status: number }).status : undefined
      setTimeout(() => store.pushError({ category, message, status }), 0)
    }
  }
})

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'threadbase-rq-cache-v2',
  throttleTime: 1000,
})

// Bumped from v1 → v2 alongside the ProjectChat migration so any cached
// session/conversation entries keyed without `projectId` are dropped instead
// of being read back as legacy data.
export const persistBuster = 'v2'

const PERSISTED_QUERY_ROOTS = new Set([
  'session',
  'conversation',
  'project',
  'serverInfo',
])

/**
 * Decide whether a successful query is allowed to persist to AsyncStorage.
 * Default: only the explicit allow-list above. Per spec, full message bodies
 * are NOT persisted unless product/security explicitly opts them in.
 *
 * Individual queries can still set `meta: { persist: false }` to bail out of
 * the allow-list (used by `useSessionDetail` to keep ephemeral status data
 * out of the persisted cache).
 */
export function shouldPersistQuery(query: { queryKey: readonly unknown[]; meta?: unknown }): boolean {
  const meta = query.meta as { persist?: boolean } | undefined
  if (meta?.persist === false) return false
  const root = String(query.queryKey[0])
  return PERSISTED_QUERY_ROOTS.has(root)
}
