import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { parsePinnedDirs, type PinnedDirEntry, type RawPinnedDirsResponse } from '@/lib/pinnedDirs'
import { createApiForServer } from '@/services/api-client'
import { useServersStore } from '@/stores/servers'

interface UnpinResponse {
  ok: boolean
  removed: boolean
}

const pinnedDirsKey = (serverId: string | undefined) => ['pinned-dirs', serverId]

/**
 * The browse screen's pinned folders for one server, kept in its runtime.db and
 * shared by every paired device. `supported` is false on a server that does not
 * report `pinnedDirs`, where the screen shows no pinning at all.
 */
export function usePinnedDirs(serverId: string | undefined): { supported: boolean; dirs: PinnedDirEntry[] } {
  const supported = useServersStore((s) => (serverId ? s.servers[serverId]?.serverInfo?.pinnedDirs === true : false))
  const { data: dirs = [] } = useQuery({
    queryKey: pinnedDirsKey(serverId),
    queryFn: async ({ signal }) =>
      parsePinnedDirs(await createApiForServer(serverId ?? '').get<RawPinnedDirsResponse>('/api/pinned-dirs', { signal })),
    enabled: !!serverId && supported,
    meta: { silentError: true },
    staleTime: 30_000,
    retry: 1,
  })
  return { supported, dirs }
}

/** Takes the browse screen's path (root-relative or absolute); the server resolves it. */
export function usePinDir(serverId: string | undefined) {
  const qc = useQueryClient()
  return useMutation<PinnedDirEntry[], Error, string>({
    mutationFn: async (path) =>
      parsePinnedDirs(await createApiForServer(serverId ?? '').put<RawPinnedDirsResponse>('/api/pinned-dirs', { path })),
    onSuccess: (dirs) => qc.setQueryData(pinnedDirsKey(serverId), dirs),
  })
}

/** Takes a pinned entry's absolute `path`. */
export function useUnpinDir(serverId: string | undefined) {
  const qc = useQueryClient()
  return useMutation<UnpinResponse, Error, string>({
    mutationFn: (path) =>
      createApiForServer(serverId ?? '').delete<UnpinResponse>(`/api/pinned-dirs?path=${encodeURIComponent(path)}`),
    onSuccess: (_res, path) =>
      qc.setQueryData<PinnedDirEntry[]>(pinnedDirsKey(serverId), (dirs) => dirs?.filter((d) => d.path !== path)),
  })
}
