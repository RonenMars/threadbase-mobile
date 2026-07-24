import { useQuery } from '@tanstack/react-query'
import { fetchPushHealth } from '@/services/push-health'

export function usePushHealth(serverId: string | null) {
  return useQuery({
    queryKey: ['push-health', serverId],
    queryFn: ({ signal }) => fetchPushHealth(serverId!, signal),
    enabled: !!serverId,
    staleTime: 15_000,
    retry: 1,
  })
}
