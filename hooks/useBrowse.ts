import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createApiForServer } from '@/services/api-client'
import type { BrowseResponse, MkdirResponse, Session } from '@/types/api'
import type { ProviderName } from '@/constants/providers'

export function useBrowse(serverId: string, path: string) {
  const api = createApiForServer(serverId)

  return useQuery<BrowseResponse>({
    queryKey: ['browse', serverId, path],
    queryFn: () => api.get<BrowseResponse>(`/api/browse?path=${encodeURIComponent(path)}`),
    enabled: !!serverId,
  })
}

export function useCreateDirectory(serverId: string) {
  const qc = useQueryClient()
  const api = createApiForServer(serverId)

  return useMutation<MkdirResponse, Error, { parentPath: string; name: string }>({
    mutationFn: ({ parentPath, name }) =>
      api.post<MkdirResponse>('/api/browse/mkdir', { path: parentPath, name }),
    onSuccess: (_data, { parentPath }) => {
      qc.invalidateQueries({ queryKey: ['browse', serverId, parentPath] })
    },
  })
}

/** `/api/sessions/start` result: a ready session, or the old async
 * fire-and-forget shape when the server times out waiting for readiness
 * (the WS session_ready listener in app/_layout.tsx handles navigation then). */
export type StartSessionResult = { kind: 'ready'; session: Session } | { kind: 'pending'; id: string }

export function useStartSession(serverId: string) {
  const qc = useQueryClient()
  const api = createApiForServer(serverId)

  return useMutation<
    StartSessionResult,
    Error,
    { path: string; projectName?: string; provider?: ProviderName }
  >({
    mutationFn: async (vars) => {
      const res = await api.post<{ session: Session } | { id: string; status: 'pending' }>(
        '/api/sessions/start',
        vars,
      )
      return 'session' in res ? { kind: 'ready', session: res.session } : { kind: 'pending', id: res.id }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      qc.invalidateQueries({ queryKey: ['sessions-eager'] })
    },
  })
}
