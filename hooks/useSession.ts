import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { api } from '@/services/api-client'
import { wsClient } from '@/services/ws-client'
import { useSessionsStore } from '@/stores/sessions'
import type { Session } from '@/types/api'

export function useSessions() {
  const setSessions = useSessionsStore((s) => s.setSessions)
  const updateSession = useSessionsStore((s) => s.updateSession)

  // WebSocket wiring
  useEffect(() => {
    const unsubList = wsClient.on('session_list', (msg) => {
      if (msg.type === 'session_list') setSessions(msg.sessions)
    })
    const unsubUpdate = wsClient.on('session_update', (msg) => {
      if (msg.type === 'session_update') updateSession(msg.session.id, msg.session)
    })
    return () => {
      unsubList()
      unsubUpdate()
    }
  }, [setSessions, updateSession])

  return useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get<Session[]>('/api/sessions'),
    refetchInterval: 3000,
    staleTime: 1000,
    select: (data) => {
      setSessions(data)
      return data
    },
  })
}

export function useSessionDetail(id: string) {
  return useQuery({
    queryKey: ['session', id],
    queryFn: () => api.get<Session>(`/api/sessions/${id}`),
    refetchInterval: 5000,
  })
}
