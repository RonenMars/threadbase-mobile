import { useQuery } from '@tanstack/react-query'
import { fetchServerDiagnostics } from '@/services/server-diagnostics'

export function useServerDiagnostics(serverId: string | null) {
  return useQuery({
    queryKey: ['server-diagnostics', serverId],
    queryFn: ({ signal }) => fetchServerDiagnostics(serverId!, signal),
    enabled: !!serverId,
    staleTime: 15_000,
    retry: 1,
  })
}
