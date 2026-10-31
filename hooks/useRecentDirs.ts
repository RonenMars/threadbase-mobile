import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSessions } from '@/hooks/useSession'
import { mergeRecentDirs, parseRecentDirs, type RawRecentDirsResponse, type RecentDirEntry } from '@/lib/recentDirs'
import { createApiForServer } from '@/services/api-client'
import { useServersStore } from '@/stores/servers'

/**
 * The browse screen's "Recent directories" for one server.
 *
 * A server that reports `recentDirs` keeps the list in runtime.db, so it
 * survives a streamer restart; the live session list fills in anything newer.
 * An older server, or a failed fetch, falls back to the live sessions alone —
 * which is all this screen had before.
 */
export function useRecentDirs(serverId: string | undefined, max: number): RecentDirEntry[] {
  const supported = useServersStore((s) => (serverId ? s.servers[serverId]?.serverInfo?.recentDirs === true : false))
  const { data: sessions = [] } = useSessions()
  const { data: recorded = [] } = useQuery({
    queryKey: ['recent-dirs', serverId],
    queryFn: async ({ signal }) =>
      parseRecentDirs(await createApiForServer(serverId ?? '').get<RawRecentDirsResponse>('/api/recent-dirs', { signal })),
    enabled: !!serverId && supported,
    // Browse has its own failure surfaces; a missing recents list is not one.
    meta: { silentError: true },
    staleTime: 30_000,
    retry: 1,
  })

  return useMemo(
    () => (serverId ? mergeRecentDirs(recorded, sessions, serverId, max) : []),
    [recorded, sessions, serverId, max],
  )
}
