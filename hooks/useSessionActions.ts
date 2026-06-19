import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createApiForServer, NetworkError, stopSession } from '@/services/api-client'
import { useSessionsStore } from '@/stores/sessions'
import type { MultiSession, QueuedPrompt } from '@/types/api'

// networkMode stays default 'online': a send fired while offline auto-pauses and
// is replayed by resumePausedMutations() on reconnect. retry bridges the
// mid-flight radio-drop case — fetch started, then dropped → NetworkError —
// where the mutation would otherwise land in error instead of pausing.
const retryOnNetwork = {
  retry: (count: number, err: Error) => err instanceof NetworkError && count < 2,
  retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 8000),
}

export function useSessionActions(serverId: string, sessionId: string) {
  const qc = useQueryClient()
  const api = createApiForServer(serverId)

  const sendInput = useMutation({
    ...retryOnNetwork,
    mutationFn: (input: string) =>
      api.post(`/api/sessions/${sessionId}/input`, { input }),
    onSuccess: () => {
      // Session status is updated via WS session_update in _layout.tsx — no invalidate needed.
      // Catch up on any terminal_output the WS missed while connecting/reconnecting.
      qc.invalidateQueries({ queryKey: ['terminal-output', serverId, sessionId] })
    },
  })

  // Send raw key sequences (arrow keys, Enter) without bracketed-paste wrapping.
  const sendKeys = useMutation({
    ...retryOnNetwork,
    mutationFn: (keys: string) =>
      api.post(`/api/sessions/${sessionId}/input`, { keys }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session', serverId, sessionId] })
    },
  })

  const cancelSession = useMutation({
    mutationFn: () => api.post(`/api/sessions/${sessionId}/cancel`),
    onSuccess: () => {
      // Targeted update: flip this session to idle in every sessions-eager cache entry
      // instead of invalidating the whole list (which triggers a full multi-server re-fetch).
      qc.setQueriesData<MultiSession[]>({ queryKey: ['sessions-eager'] }, (prev) =>
        prev?.map((s) =>
          s.id === sessionId && s.serverId === serverId ? { ...s, status: 'idle' } : s,
        ),
      )
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
    ...retryOnNetwork,
    mutationFn: (vars: { action: 'proceed' | 'cancel' | 'edit'; editedPrompt?: string }) =>
      api.post(`/api/sessions/${sessionId}/plan-response`, vars),
  })

  const respondToQuestion = useMutation({
    ...retryOnNetwork,
    mutationFn: (vars: { toolUseId: string; answers: Record<string, string | string[]> }) =>
      api.post(`/api/sessions/${sessionId}/answer`, vars),
  })

  const adoptSession = useMutation({
    mutationFn: () =>
      api.post<{ sessionId: string }>(`/api/sessions/${sessionId}/adopt`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      qc.invalidateQueries({ queryKey: ['sessions-eager'] })
    },
  })

  // Hard-kills the PTY via /stop. Status is driven idle by the WS session_update
  // the server broadcasts after the stream closes, so we only refresh the lists.
  const stopSessionMutation = useMutation({
    mutationFn: () => stopSession(serverId, sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      qc.invalidateQueries({ queryKey: ['sessions-eager'] })
      qc.invalidateQueries({ queryKey: ['session', serverId, sessionId] })
    },
  })

  return { sendInput, sendKeys, cancelSession, addToQueue, removeFromQueue, respondToPlan, respondToQuestion, adoptSession, stopSession: stopSessionMutation }
}
