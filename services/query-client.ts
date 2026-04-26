import AsyncStorage from '@react-native-async-storage/async-storage'
import { QueryClient } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'

const ONE_MINUTE = 1000 * 60
const ONE_DAY = ONE_MINUTE * 60 * 24

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

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'threadbase-rq-cache-v1',
  throttleTime: 1000,
})

// Bumped when query shapes change — invalidates persisted cache on restore.
export const persistBuster = 'v1'
