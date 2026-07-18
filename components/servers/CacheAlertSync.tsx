import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCacheAlert } from '@/services/api-client'
import { useServersStore } from '@/stores/servers'

// Fetches GET /api/cache/alert for one server and feeds the result through the
// same setCacheAlert/clearCacheAlert reducers as the WS path, so a client that
// missed the WS unicast (e.g. backgrounded when it arrived) still converges.
// refetchOnWindowFocus (react-query default) covers the foreground case.
function CacheAlertSyncEntry({ serverId, isConnected }: { serverId: string; isConnected: boolean }) {
  const setCacheAlert = useServersStore((s) => s.setCacheAlert)
  const clearCacheAlert = useServersStore((s) => s.clearCacheAlert)
  const { data } = useQuery({
    queryKey: ['cache-alert', serverId],
    queryFn: () => getCacheAlert(serverId),
    enabled: isConnected,
    meta: { persist: false },
  })

  useEffect(() => {
    if (data === undefined) return
    if (data) {
      setCacheAlert(serverId, data)
    } else {
      const current = useServersStore.getState().cacheAlert[serverId]
      if (current) clearCacheAlert(serverId, current.fingerprint)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, serverId])

  return null
}

/** Mount once near the app root. Syncs GET /api/cache/alert for every connected server. */
export function CacheAlertSync() {
  const servers = useServersStore((s) => s.servers)
  const activeServerIds = useServersStore((s) => s.activeServerIds)

  return (
    <>
      {activeServerIds.map((serverId) => (
        <CacheAlertSyncEntry key={serverId} serverId={serverId} isConnected={servers[serverId]?.isConnected ?? false} />
      ))}
    </>
  )
}
