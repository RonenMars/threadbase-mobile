import { useQuery } from '@tanstack/react-query'
import { createApiForServer } from '@/services/api-client'
import type { Session, PopularProject } from '@/types/api'

export function useRecentSessions(serverId: string, limit = 20) {
  return useQuery({
    queryKey: ['quick-access-recents', serverId, limit],
    queryFn: () =>
      createApiForServer(serverId).get<{ sessions: Session[]; total: number }>(
        `/api/sessions/recents?limit=${limit}`
      ),
    staleTime: 30_000,
    enabled: !!serverId,
  })
}

export function usePopularProjects(serverId: string, limit = 20) {
  return useQuery({
    queryKey: ['quick-access-popular', serverId, limit],
    queryFn: () =>
      createApiForServer(serverId).get<{ projects: PopularProject[]; total: number }>(
        `/api/projects/popular?limit=${limit}`
      ),
    staleTime: 5 * 60_000,
    enabled: !!serverId,
  })
}
