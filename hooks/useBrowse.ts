import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createApiForServer } from '@/services/api-client'
import type { BrowseResponse, MkdirResponse, Session } from '@/types/api'
import type { ProviderName } from '@/constants/providers'
import { clientLog } from '@/lib/clientLog'

export function useBrowse(serverId: string, path: string) {
  clientLog.info('useBrowse', 'useBrowse called', { serverId, path, enabled: !!serverId })
  const api = createApiForServer(serverId)
  clientLog.info('useBrowse', 'createApiForServer ready', { serverId, hasApi: !!api })

  const queryKey = ['browse', serverId, path] as const
  clientLog.info('useBrowse', 'building useQuery', { queryKey: [...queryKey], enabled: !!serverId })

  return useQuery<BrowseResponse>({
    queryKey,
    queryFn: async () => {
      const url = `/api/browse?path=${encodeURIComponent(path)}`
      clientLog.info('useBrowse', 'queryFn start', { serverId, path, url })
      try {
        const data = await api.get<BrowseResponse>(url)
        clientLog.info('useBrowse', 'queryFn success', {
          serverId,
          path,
          responsePath: data?.path,
          directoriesCount: data?.directories?.length,
        })
        return data
      } catch (err) {
        clientLog.info('useBrowse', 'queryFn error', {
          serverId,
          path,
          message: err instanceof Error ? err.message : String(err),
          code: err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined,
        })
        throw err
      }
    },
    enabled: !!serverId,
  })
}

export function useCreateDirectory(serverId: string) {
  clientLog.info('useBrowse', 'useCreateDirectory called', { serverId })
  const qc = useQueryClient()
  clientLog.info('useBrowse', 'useCreateDirectory got queryClient', { serverId })
  const api = createApiForServer(serverId)
  clientLog.info('useBrowse', 'useCreateDirectory createApiForServer ready', { serverId, hasApi: !!api })

  return useMutation<MkdirResponse, Error, { parentPath: string; name: string }>({
    mutationFn: async ({ parentPath, name }) => {
      clientLog.info('useBrowse', 'createDirectory mutationFn start', { serverId, parentPath, name })
      try {
        const data = await api.post<MkdirResponse>('/api/browse/mkdir', { path: parentPath, name })
        clientLog.info('useBrowse', 'createDirectory mutationFn success', {
          serverId,
          parentPath,
          name,
          data,
        })
        return data
      } catch (err) {
        clientLog.info('useBrowse', 'createDirectory mutationFn error', {
          serverId,
          parentPath,
          name,
          message: err instanceof Error ? err.message : String(err),
        })
        throw err
      }
    },
    onSuccess: (_data, { parentPath }) => {
      const invalidateKey = ['browse', serverId, parentPath]
      clientLog.info('useBrowse', 'createDirectory onSuccess invalidateQueries', {
        serverId,
        parentPath,
        invalidateKey,
      })
      qc.invalidateQueries({ queryKey: invalidateKey })
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
  clientLog.info('useBrowse', 'classifyStartSessionResponse input', {
    keys: res && typeof res === 'object' ? Object.keys(res) : [],
    hasSession: !!(res && typeof res === 'object' && 'session' in res),
    status: res && typeof res === 'object' && 'status' in res ? (res as { status?: string }).status : undefined,
    id: res && typeof res === 'object' && 'id' in res ? (res as { id?: string }).id : undefined,
  })
  if ('session' in res && res.session && typeof res.session === 'object' && 'id' in res.session) {
    clientLog.info('useBrowse', 'classifyStartSessionResponse → ready (wrapped session)', {
      sessionId: res.session.id,
      projectId: res.session.projectId,
      projectPath: res.session.projectPath,
    })
    return { kind: 'ready', session: res.session }
  }
  if ('status' in res && res.status === 'pending' && typeof res.id === 'string') {
    clientLog.info('useBrowse', 'classifyStartSessionResponse → pending', { id: res.id })
    return { kind: 'pending', id: res.id }
  }
  if ('id' in res && typeof res.id === 'string') {
    clientLog.info('useBrowse', 'classifyStartSessionResponse → ready (bare session)', {
      sessionId: res.id,
      projectId: (res as Session).projectId,
      projectPath: (res as Session).projectPath,
    })
    return { kind: 'ready', session: res as Session }
  }
  clientLog.info('useBrowse', 'classifyStartSessionResponse unexpected shape', { res })
  throw new Error('Unexpected /api/sessions/start response shape')
}

// The server's own ready-wait is 10s (START_READY_TIMEOUT_MS) before it falls
// back to the 202-pending shape — this must exceed that with margin so the
// client never aborts first. Retry is disabled: start is non-idempotent, and
// retrying a timed-out request spawns a second PTY server-side.
// Exported so /session/new can render the countdown against the same budget.
export const START_SESSION_TIMEOUT_MS = 15_000

export function useStartSession(serverId: string) {
  clientLog.info('useBrowse', 'useStartSession called', { serverId, timeoutMs: START_SESSION_TIMEOUT_MS })
  const qc = useQueryClient()
  clientLog.info('useBrowse', 'useStartSession got queryClient', { serverId })
  const api = createApiForServer(serverId)
  clientLog.info('useBrowse', 'useStartSession createApiForServer ready', { serverId, hasApi: !!api })

  return useMutation<
    StartSessionResult,
    Error,
    { path: string; projectName?: string; provider?: ProviderName }
  >({
    mutationFn: async (vars) => {
      clientLog.info('startSession', '0. mutationFn entered (about to POST)', {
        serverId,
        vars,
        timeoutMs: START_SESSION_TIMEOUT_MS,
        retry: false,
      })
      clientLog.info('useBrowse', 'startSession mutationFn start', {
        serverId,
        vars,
        timeoutMs: START_SESSION_TIMEOUT_MS,
        retry: false,
      })
      try {
        const res = await api.post<StartSessionResponse>('/api/sessions/start', vars, {
          timeoutMs: START_SESSION_TIMEOUT_MS,
          retry: false,
        })
        clientLog.info('startSession', '0b. mutationFn got POST result (pre-classify)', {
          serverId,
          vars,
          resKeys: res && typeof res === 'object' ? Object.keys(res) : [],
          res,
        })
        clientLog.info('useBrowse', 'startSession POST success, classifying', {
          serverId,
          vars,
          resKeys: res && typeof res === 'object' ? Object.keys(res) : [],
        })
        const classified = classifyStartSessionResponse(res)
        clientLog.info('startSession', '0c. mutationFn classified', {
          serverId,
          kind: classified.kind,
          id: classified.kind === 'ready' ? classified.session.id : classified.id,
          classified,
        })
        clientLog.info('useBrowse', 'startSession mutationFn classified', {
          serverId,
          kind: classified.kind,
          id: classified.kind === 'ready' ? classified.session.id : classified.id,
        })
        return classified
      } catch (err) {
        clientLog.info('startSession', '0d. mutationFn ERROR', {
          serverId,
          vars,
          message: err instanceof Error ? err.message : String(err),
          code: err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined,
        })
        clientLog.info('useBrowse', 'startSession mutationFn error', {
          serverId,
          vars,
          message: err instanceof Error ? err.message : String(err),
          code: err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined,
        })
        throw err
      }
    },
    onSuccess: (result) => {
      clientLog.info('startSession', '0e. mutation onSuccess (invalidate caches)', {
        serverId,
        kind: result.kind,
        id: result.kind === 'ready' ? result.session.id : result.id,
      })
      clientLog.info('useBrowse', 'startSession onSuccess invalidate sessions queries', {
        serverId,
        kind: result.kind,
        id: result.kind === 'ready' ? result.session.id : result.id,
      })
      qc.invalidateQueries({ queryKey: ['sessions'] })
      qc.invalidateQueries({ queryKey: ['sessions-eager'] })
      clientLog.info('useBrowse', 'startSession onSuccess invalidation done', { serverId })
    },
  })
}
