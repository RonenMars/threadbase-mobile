import { useQuery } from '@tanstack/react-query'
import { createApiForServer } from '@/services/api-client'
import { useSessionsStore } from '@/stores/sessions'
import { useServersStore } from '@/stores/servers'
import type { Session } from '@/types/api'

export function useSessions() {
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const setSessions = useSessionsStore((s) => s.setSessions)

  return useQuery({
    queryKey: ['sessions', ...activeServerIds],
    queryFn: async () => {
      const results = await Promise.all(
        activeServerIds.map(async (serverId) => {
          const api = createApiForServer(serverId)
          const sessions = await api.get<Session[]>('/api/sessions')
          return { serverId, sessions }
        })
      )
      for (const { serverId, sessions } of results) {
        setSessions(serverId, sessions)
      }
      return results
    },
    enabled: activeServerIds.length > 0,
  })
}

export function useSessionDetail(serverId: string, sessionId: string) {
  const api = createApiForServer(serverId)
  return useQuery({
    queryKey: ['session', serverId, sessionId],
    queryFn: () => api.get<Session>(`/api/sessions/${sessionId}`),
  })
}
