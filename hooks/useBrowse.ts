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

/** `/api/sessions/start` result: a ready session, or the async
 * fire-and-forget shape when the server times out waiting for readiness. */
export type StartSessionResult = { kind: 'ready'; session: Session } | { kind: 'pending'; id: string }

type StartSessionResponse =
  | { session: Session }
  | { id: string; status: 'pending' }
  | Session

function classifyStartSessionResponse(res: StartSessionResponse): StartSessionResult {
  if ('session' in res && res.session && typeof res.session === 'object' && 'id' in res.session) {
    return { kind: 'ready', session: res.session }
  }
  if ('status' in res && res.status === 'pending' && typeof res.id === 'string') {
    return { kind: 'pending', id: res.id }
  }
  if ('id' in res && typeof res.id === 'string') {
    return { kind: 'ready', session: res as Session }
  }
  throw new Error('Unexpected /api/sessions/start response shape')
}

// The server's own ready-wait is 10s (START_READY_TIMEOUT_MS) before it falls
// back to the 202-pending shape — this must exceed that with margin so the
// client never aborts first. Retry is disabled: start is non-idempotent, and
// retrying a timed-out request spawns a second PTY server-side.
const START_SESSION_TIMEOUT_MS = 15_000

export function useStartSession(serverId: string) {
  const qc = useQueryClient()
  const api = createApiForServer(serverId)

  return useMutation<
    StartSessionResult,
    Error,
    { path: string; projectName?: string; provider?: ProviderName }
  >({
    mutationFn: async (vars) => {
      const res = await api.post<StartSessionResponse>('/api/sessions/start', vars, {
        timeoutMs: START_SESSION_TIMEOUT_MS,
        retry: false,
      })
      return classifyStartSessionResponse(res)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      qc.invalidateQueries({ queryKey: ['sessions-eager'] })
    },
  })
}
