import AsyncStorage from '@react-native-async-storage/async-storage'
import { QueryClient } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { useSlowQueryStore } from '@/stores/slow-query'

const ONE_MINUTE = 1000 * 60
const ONE_DAY = ONE_MINUTE * 60 * 24
const SLOW_QUERY_THRESHOLD_MS = 7000

// Per-query timer handles — keyed by query hash so each query tracks independently.
const slowTimers = new Map<string, ReturnType<typeof setTimeout>>()

function clearSlowTimer(hash: string) {
  const t = slowTimers.get(hash)
  if (t !== undefined) {
    clearTimeout(t)
    slowTimers.delete(hash)
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30 * 1000,
      gcTime: ONE_DAY,
      refetchOnReconnect: true,
    },
  },
})

// Observe fetching state changes to start/clear slow timers.
queryClient.getQueryCache().subscribe((event) => {
  if (!event) return
  const { query } = event
  const hash = query.queryHash

  if (query.state.fetchStatus === 'fetching') {
    // Start a timer only if one isn't already running for this query.
    if (!slowTimers.has(hash)) {
      const t = setTimeout(() => {
        slowTimers.delete(hash)
        useSlowQueryStore.getState().increment()
        // Decrement when the query eventually settles.
        const unsub = queryClient.getQueryCache().subscribe((e) => {
          if (!e || e.query.queryHash !== hash) return
          if (e.query.state.fetchStatus !== 'fetching') {
            useSlowQueryStore.getState().decrement()
            unsub()
          }
        })
      }, SLOW_QUERY_THRESHOLD_MS)
      slowTimers.set(hash, t)
    }
  } else {
    // Query is no longer fetching — cancel any pending slow timer.
    clearSlowTimer(hash)
  }
})

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'threadbase-rq-cache-v1',
  throttleTime: 1000,
})

// Bumped when query shapes change — invalidates persisted cache on restore.
export const persistBuster = 'v1'
