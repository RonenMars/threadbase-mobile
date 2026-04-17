import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { createApiForServer } from '@/services/api-client'
import { wsManager } from '@/services/ws-client'
import { useSessionsStore } from '@/stores/sessions'
import { useServersStore } from '@/stores/servers'
import type { Session } from '@/types/api'

export function useSessions() {
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const setSessions = useSessionsStore((s) => s.setSessions)
  const updateSession = useSessionsStore((s) => s.updateSession)

  // WebSocket wiring across all servers
  useEffect(() => {
    const unsubList = wsManager.onAll('session_list', (msg) => {
      if (msg.type === 'session_list') setSessions(msg.serverId, msg.sessions)
    })
    const unsubUpdate = wsManager.onAll('session_update', (msg) => {
      if (msg.type === 'session_update') updateSession(msg.serverId, msg.session.id, msg.session)
    })
    return () => {
      unsubList()
      unsubUpdate()
    }
  }, [activeServerIds, setSessions, updateSession])

  const query = useQuery({
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
    refetchInterval: 3000,
    staleTime: 1000,
    enabled: activeServerIds.length > 0,
  })

  return query
}

export function useSessionDetail(serverId: string, sessionId: string) {
  const api = createApiForServer(serverId)
  return useQuery({
    queryKey: ['session', serverId, sessionId],
    queryFn: () => api.get<Session>(`/api/sessions/${sessionId}`),
    refetchInterval: 5000,
  })
}
