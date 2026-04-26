import { useQuery } from '@tanstack/react-query'
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

export function useSessionDetail(serverId: string, sessionId: string) {
  const api = createApiForServer(serverId)
  return useQuery({
    queryKey: ['session', serverId, sessionId],
    queryFn: () => api.get<Session>(`/api/sessions/${sessionId}`),
  })
}
