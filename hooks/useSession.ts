import { useQueries, useQuery } from '@tanstack/react-query'
import { createApiForServer } from '@/services/api-client'
import { useServersStore } from '@/stores/servers'
import type { MultiSession, Session } from '@/types/api'

interface PerServerSessions {
  serverId: string
  sessions: Session[]
}

export function useSessions() {
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const servers = useServersStore((s) => s.servers)

  return useQuery<PerServerSessions[], Error, MultiSession[]>({
    queryKey: ['sessions', ...activeServerIds],
    queryFn: async () => {
      return Promise.all(
        activeServerIds.map(async (serverId) => {
          const api = createApiForServer(serverId)
          const sessions = await api.get<Session[]>('/api/sessions')
          return { serverId, sessions }
        })
      )
    },
    select: (data) => {
      const merged: MultiSession[] = []
      for (const { serverId, sessions } of data) {
        const label = servers[serverId]?.label
        for (const s of sessions) {
          merged.push({ ...s, serverId, serverLabel: label })
        }
      }
      return merged
    },
    enabled: activeServerIds.length > 0,
  })
}

export function useEagerSessions() {
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const servers = useServersStore((s) => s.servers)

  // Step 1: fetch session count per server
  const countQueries = useQueries({
    queries: activeServerIds.map((serverId) => ({
      queryKey: ['sessions-count', serverId],
      queryFn: () =>
        createApiForServer(serverId).get<{ total: number }>('/api/sessions/count'),
      enabled: activeServerIds.length > 0,
    })),
  })

  const countsDone = activeServerIds.length === 0 || countQueries.every((q) => q.isSuccess || q.isError)
  const total = countQueries.reduce((sum, q) => sum + (q.data?.total ?? 0), 0)

  // Step 2: fetch all sessions per server (single page each)
  const sessionQueries = useQueries({
    queries: countsDone
      ? activeServerIds.map((serverId) => ({
          queryKey: ['sessions', serverId],
          queryFn: () =>
            createApiForServer(serverId).get<Session[]>('/api/sessions'),
        }))
      : [],
  })

  const loaded = sessionQueries
    .filter((q) => q.isSuccess)
    .reduce((sum, q) => sum + (q.data?.length ?? 0), 0)

  const isDone =
    activeServerIds.length === 0 ||
    (countsDone && sessionQueries.every((q) => q.isSuccess || q.isError))

  const sessions: MultiSession[] = []
  for (let i = 0; i < activeServerIds.length; i++) {
    const serverId = activeServerIds[i]
    const label = servers[serverId]?.label
    const data = sessionQueries[i]?.data ?? []
    for (const s of data) {
      sessions.push({ ...s, serverId, serverLabel: label })
    }
  }

  const refetch = async () => {
    await Promise.all([
      ...countQueries.map((q) => q.refetch()),
      ...sessionQueries.map((q) => q.refetch()),
    ])
  }

  return { sessions, loaded, total, isDone, isCounting: !countsDone, refetch }
}

export function useSessionDetail(serverId: string, sessionId: string) {
  const api = createApiForServer(serverId)
  return useQuery({
    queryKey: ['session', serverId, sessionId],
    queryFn: () => api.get<Session>(`/api/sessions/${sessionId}`),
  })
}
