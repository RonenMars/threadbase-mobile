import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchDevices, revokeDevice } from '@/services/devices'

export function useDevices(serverId: string | null) {
  return useQuery({
    queryKey: ['devices', serverId],
    queryFn: ({ signal }) => fetchDevices(serverId!, signal),
    enabled: !!serverId,
    staleTime: 15_000,
    retry: 1,
  })
}

export function useRevokeDevice(serverId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (deviceId: string) => revokeDevice(serverId!, deviceId),
    onSuccess: () => {
      if (serverId) void qc.invalidateQueries({ queryKey: ['devices', serverId] })
    },
  })
}
