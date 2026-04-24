import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createApiForServer } from '@/services/api-client'
import type { BrowseResponse, MkdirResponse, Session } from '@/types/api'

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

export function useStartSession(serverId: string) {
  const qc = useQueryClient()
  const api = createApiForServer(serverId)

  return useMutation<Session, Error, { path: string; projectName?: string }>({
    mutationFn: (vars) => api.post<Session>('/api/sessions/start', vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
    },
  })
}
