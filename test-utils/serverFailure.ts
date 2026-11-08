import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'

/**
 * Puts a server straight into the published `error` state. `recordFailure`
 * holds a first failure back for FAILURE_BANNER_DELAY_MS, which view tests do
 * not want to wait out; the delay itself is covered in the store's own suite.
 */
export function seedServerFailure(serverId: string, message = 'offline') {
  useServerFetchStatusStore.setState((s) => ({
    statuses: {
      ...s.statuses,
      [serverId]: { status: 'error', error: message, lastCheckedAt: Date.now() },
    },
  }))
}
