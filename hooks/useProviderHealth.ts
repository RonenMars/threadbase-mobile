import { useQuery } from '@tanstack/react-query'
import { fetchProviderHealth } from '@/services/provider-health'

export function useProviderHealth(serverId: string | null | undefined) {
  return useQuery({
    queryKey: ['provider-health', serverId],
    queryFn: ({ signal }) => fetchProviderHealth(serverId!, signal),
    enabled: !!serverId,
    // Browse renders its own failure state, and ErrorBanner deliberately keeps
    // the `browse` category out of the global sheet. This query is keyed
    // 'provider-health' though, so categoryForHash files it under 'other' and
    // it raised a global "Something went wrong" anyway — including against a
    // streamer too old to serve /api/providers at all.
    meta: { silentError: true },
    staleTime: 60_000,
    retry: 1,
  })
}
