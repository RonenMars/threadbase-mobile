import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createApiForServer } from '@/services/api-client'

export function useSessionActions(serverId: string, sessionId: string) {
  const qc = useQueryClient()
  const api = createApiForServer(serverId)

  const sendInput = useMutation({
    mutationFn: (input: string) =>
      api.post(`/api/sessions/${sessionId}/input`, { input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session', serverId, sessionId] })
    },
  })

  const cancelSession = useMutation({
    mutationFn: () => api.post(`/api/sessions/${sessionId}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
    },
  })

  const addToQueue = useMutation({
    mutationFn: (text: string) =>
      api.post(`/api/sessions/${sessionId}/queue`, { text }),
  })

  const removeFromQueue = useMutation({
    mutationFn: (promptId: string) =>
      api.delete(`/api/sessions/${sessionId}/queue/${promptId}`),
  })

  const respondToPlan = useMutation({
    mutationFn: (vars: { action: 'proceed' | 'cancel' | 'edit'; editedPrompt?: string }) =>
      api.post(`/api/sessions/${sessionId}/plan-response`, vars),
  })

  return { sendInput, cancelSession, addToQueue, removeFromQueue, respondToPlan }
}
