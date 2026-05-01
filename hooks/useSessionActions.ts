import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createApiForServer } from '@/services/api-client'
import { useSessionsStore } from '@/stores/sessions'
import type { QueuedPrompt } from '@/types/api'

export function useSessionActions(serverId: string, sessionId: string) {
  const qc = useQueryClient()
  const api = createApiForServer(serverId)

  const sendInput = useMutation({
    mutationFn: (input: string) =>
      api.post(`/api/sessions/${sessionId}/input`, { input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session', serverId, sessionId] })
      // Catch up on any terminal_output the WS missed while connecting/reconnecting.
      qc.invalidateQueries({ queryKey: ['terminal-output', serverId, sessionId] })
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
      api.post<QueuedPrompt>(`/api/sessions/${sessionId}/queue`, { text }),
    onSuccess: (prompt) => {
      useSessionsStore.getState().addToQueue(serverId, sessionId, prompt)
    },
  })

  const removeFromQueue = useMutation({
    mutationFn: (promptId: string) =>
      api.delete(`/api/sessions/${sessionId}/queue/${promptId}`),
    onSuccess: (_data, promptId) => {
      useSessionsStore.getState().removeFromQueue(serverId, sessionId, promptId)
    },
  })

  const respondToPlan = useMutation({
    mutationFn: (vars: { action: 'proceed' | 'cancel' | 'edit'; editedPrompt?: string }) =>
      api.post(`/api/sessions/${sessionId}/plan-response`, vars),
  })

  const adoptSession = useMutation({
    mutationFn: () =>
      api.post<{ sessionId: string }>(`/api/sessions/${sessionId}/adopt`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
    },
  })

  return { sendInput, cancelSession, addToQueue, removeFromQueue, respondToPlan, adoptSession }
}
