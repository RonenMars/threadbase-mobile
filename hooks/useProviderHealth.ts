import { useQuery } from '@tanstack/react-query'
import { fetchProviderHealth } from '@/services/provider-health'

export function useProviderHealth(serverId: string | null | undefined) {
  return useQuery({
    queryKey: ['provider-health', serverId],
    queryFn: ({ signal }) => fetchProviderHealth(serverId!, signal),
    enabled: !!serverId,
    staleTime: 60_000,
    retry: 1,
  })
}
