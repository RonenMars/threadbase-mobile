import { useMutation, useQuery } from '@tanstack/react-query'
import { createApiForServer } from '@/services/api-client'
import { useSessionNamesStore } from '@/stores/sessionNames'
import type { NameOrigin } from '@/stores/sessionNames'

export function useRenameSession(serverId: string) {
  const { setName, getName, getOrigin } = useSessionNamesStore()

  type Context = { prevName: string | undefined; prevOrigin: NameOrigin | undefined }
  return useMutation<void, Error, { sessionId: string; name: string }, Context>({
    mutationFn: async ({ sessionId, name }) => {
      const api = createApiForServer(serverId)
      await api.patch(`/api/sessions/${sessionId}/name`, { name })
    },
    onMutate: ({ sessionId, name }) => {
      const prevName = getName(serverId, sessionId)
      const prevOrigin = getOrigin(serverId, sessionId)
      setName(serverId, sessionId, name, 'manual')
      return { prevName, prevOrigin }
    },
    onError: (_err, { sessionId }, context) => {
      if (context?.prevName !== undefined) {
        setName(serverId, sessionId, context.prevName, context.prevOrigin ?? 'auto')
      }
    },
  })
}

export function useFetchSessionNames(serverId: string) {
  const { mergeFromServer } = useSessionNamesStore()

  return useQuery({
    queryKey: ['sessionNames', serverId],
    queryFn: async () => {
      const api = createApiForServer(serverId)
      const data = await api.get<Record<string, string>>('/api/sessions/names')
      mergeFromServer(serverId, data)
      return data
    },
    staleTime: 60_000,
  })
}
