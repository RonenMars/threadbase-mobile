import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createApiForServer, isAnswerRefusedError, isPermissionClosedError, isPromptClosedError, isPromptPendingError, isPromptStaleError, isQuestionClosedError, NetworkError, NotFoundError, stopSession } from '@/services/api-client'
import { START_SESSION_TIMEOUT_MS } from '@/hooks/useBrowse'
import { useSessionsStore } from '@/stores/sessions'
import type { MultiSession, QueuedPrompt, Session } from '@/types/api'
import type { ResumeConversationResponse } from '@/types/projectChat'
import { normalizeResumeResponse } from '@/utils/normalizeResumeResponse'

/** Normalised result of a successful resume, ready for cache-seed + navigation. */
export interface ResumeResult {
  sessionId: string
  projectId?: string
  projectPath?: string | null
  conversationId: string
  sessionSnapshot: Session | null
}

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
    // A 409 prompt_pending is the server refusing text while a card is open.
    // Deterministic until the card is answered, so retrying only holds the
    // refusal back from the user for the backoff window.
    retry: (count: number, err: Error) =>
      err instanceof NetworkError && !isPromptPendingError(err) && count < 2,
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

  const sendRawKey = useMutation({
    mutationFn: (vars: { action: 'escape' | 'up' | 'down' | 'left' | 'right' | 'tab' | 'shift_tab' | 'enter'; promptId?: string; confirm?: true }) =>
      api.post(`/api/sessions/${sessionId}/raw-key`, vars),
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
    // Keep the radio-drop retry, but never retry a question the server says is
    // closed: a retry cannot succeed, and it overwrites the settled error with
    // `no_pending_question` (the 409 path drops the pending entry), which is
    // what the call sites read to tell a benign close from a real failure.
    // A refused answer shape is deterministic too, but the question is still
    // open: it is not retried, and it is not classified as closed either.
    retry: (count: number, err: Error) =>
      err instanceof NetworkError && !isQuestionClosedError(err) && !isAnswerRefusedError(err) && count < 2,
    mutationFn: (vars: { toolUseId: string; answers: Record<string, string | string[]> }) =>
      api.post(`/api/sessions/${sessionId}/answer`, vars),
  })

  // Permission gates answer over a validated route that binds the answer to the
  // gate's *content*, so a stale tap cannot land on a different gate that merely
  // shares a shape. Content, not instance: two runs of the identical command are
  // indistinguishable to it.
  //
  // The client sends a position and never keystrokes. The server derives the
  // bytes from its own copy of the gate, which is what keeps the two
  // key-derivations from drifting apart.
  //
  // `keys` is the fallback payload, computed by the caller from the same block.
  // It is reached on exactly two triggers: the gate carried no contentKey (a
  // streamer too old to have the route, so there is no point spending a round
  // trip to find that out), or the route 404s (the same conclusion, one round
  // trip later). Every other failure is thrown for the caller to classify.
  const answerPermission = useMutation({
    ...retryOnNetwork,
    // Same rule as respondToQuestion: never retry a gate the server says is
    // closed. A retry cannot succeed, and it would overwrite the settled reason
    // the call sites read to tell a benign close from a real failure.
    retry: (count: number, err: Error) =>
      err instanceof NetworkError && !isPermissionClosedError(err) && count < 2,
    mutationFn: async (vars: { contentKey?: string; gateId?: string; optionIndex: number; keys: string | null }) => {
      const sendKeysFallback = () => {
        if (vars.keys === null) {
          // A plain Error, not NetworkError: this never touched the network, so the
          // retry predicate's `instanceof NetworkError` check must be false, not just
          // its closed-code list — retrying a deterministic client-side throw is pure
          // wasted time and keeps the card's rows locked for nothing.
          throw new Error('This option carries no keystrokes to send')
        }
        return api.post(`/api/sessions/${sessionId}/input`, { keys: vars.keys })
      }
      if (vars.contentKey === undefined) return sendKeysFallback()
      try {
        // gateId is the server's per-instance identity for the gate; contentKey
        // stays because a streamer that predates gateId answers on it alone.
        // Omitted rather than sent as undefined so the body is byte-identical
        // to the old one when the gate carried none.
        return await api.post(`/api/sessions/${sessionId}/permission/answer`, {
          contentKey: vars.contentKey,
          optionIndex: vars.optionIndex,
          ...(vars.gateId !== undefined ? { gateId: vars.gateId } : {}),
        })
      } catch (err) {
        if (!(err instanceof NotFoundError)) throw err
        return sendKeysFallback()
      }
    },
  })

  // Provider-neutral answer route: the prompt and option are named by the
  // opaque ids the server minted, and the revision the card was built from is
  // echoed so an answer to an older shape is refused rather than misapplied.
  // The caller mints `idempotencyKey` once per tap, so the two network retries
  // replay the same answer instead of settling the prompt twice.
  const answerPrompt = useMutation({
    ...retryOnNetwork,
    retry: (count: number, err: Error) =>
      err instanceof NetworkError && !isPromptClosedError(err) && !isPromptStaleError(err) && count < 2,
    mutationFn: (vars: { promptId: string; revision: number; questionId: string; optionId: string; idempotencyKey: string }) =>
      api.post(`/api/sessions/${sessionId}/prompt/answer`, {
        promptId: vars.promptId,
        revision: vars.revision,
        responses: [{ questionId: vars.questionId, optionIds: [vars.optionId] }],
        idempotencyKey: vars.idempotencyKey,
      }),
  })

  // Model and effort are written into the live PTY as slash commands, so the
  // route answers 202 with nothing truthful to echo back — the client confirms
  // by refetching the session. retry:false: a silent retry after a timeout
  // types the same slash command twice.
  const sessionKey = ['session', serverId, sessionId]

  const setModel = useMutation({
    retry: false,
    mutationFn: (model: string) =>
      api.patch(`/api/sessions/${sessionId}/model`, { model }),
    onMutate: async (model: string) => {
      await qc.cancelQueries({ queryKey: sessionKey })
      const previous = qc.getQueryData<Session>(sessionKey)
      qc.setQueryData<Session>(sessionKey, (prev) => (prev ? { ...prev, model } : prev))
      return { previous }
    },
    onError: (_err, _model, ctx) => {
      if (ctx) qc.setQueryData(sessionKey, ctx.previous)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: sessionKey })
    },
  })

  const setEffort = useMutation({
    retry: false,
    mutationFn: (effort: string) =>
      api.patch(`/api/sessions/${sessionId}/effort`, { effort }),
    onMutate: async (effort: string) => {
      await qc.cancelQueries({ queryKey: sessionKey })
      const previous = qc.getQueryData<Session>(sessionKey)
      qc.setQueryData<Session>(sessionKey, (prev) => (prev ? { ...prev, effort } : prev))
      return { previous }
    },
    onError: (_err, _effort, ctx) => {
      if (ctx) qc.setQueryData(sessionKey, ctx.previous)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: sessionKey })
    },
  })

  const adoptSession = useMutation({
    mutationFn: () =>
      api.post<{ sessionId: string }>(`/api/sessions/${sessionId}/adopt`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      qc.invalidateQueries({ queryKey: ['sessions-eager'] })
    },
  })

  // Resumes the conversation `sessionId` into a live PTY session. Non-idempotent
  // (spawns a PTY) — retry:false so a client timeout never double-spawns. Uses
  // START_SESSION_TIMEOUT_MS since resume spawns a PTY the same way start does.
  // A soft 409 (the conversation may still be open elsewhere) surfaces as a
  // ConversationBusyError to onError, carrying the structured detection payload;
  // callers confirm and retry with `{ force: true }`.
  //
  // The session id comes from `id` — the server sends no `sessionId` key. There
  // is no shape branch: normalizeResumeResponse returns null for the legacy
  // `{ id }` body and a Session for a full one, which is the only difference
  // between them that matters here.
  const resume = useMutation({
    mutationFn: async ({ force }: { force?: boolean } = {}): Promise<ResumeResult> => {
      const resp = await api.post<ResumeConversationResponse>(
        '/api/sessions/resume',
        { sessionId, ...(force ? { force: true } : {}) },
        { timeoutMs: START_SESSION_TIMEOUT_MS, retry: false },
      )
      return {
        sessionId: resp.sessionId ?? resp.id,
        projectId: resp.projectId,
        projectPath: resp.projectPath,
        conversationId: resp.conversationId ?? sessionId,
        sessionSnapshot: normalizeResumeResponse(resp),
      }
    },
  })

  // Forks the conversation into a separate managed session (`codex fork`),
  // leaving the process that already owns the original rollout untouched. Same
  // non-idempotent spawn as resume — retry:false, because a silent retry of a
  // timed-out fork would create a second fork rather than reusing the first.
  // `conversationId` is the NEW rollout the server bound; the source id stays
  // `sessionId`, so callers can attribute both.
  const forkSession = useMutation({
    mutationFn: async (): Promise<ResumeResult> => {
      const resp = await api.post<ResumeConversationResponse>(
        `/api/sessions/${sessionId}/fork`,
        undefined,
        { timeoutMs: START_SESSION_TIMEOUT_MS, retry: false },
      )
      return {
        sessionId: resp.sessionId ?? resp.id,
        projectId: resp.projectId,
        projectPath: resp.projectPath,
        conversationId: resp.conversationId ?? resp.id,
        sessionSnapshot: normalizeResumeResponse(resp),
      }
    },
    onSuccess: () => {
      // Refresh the source conversation now; the forked rollout's own detail is
      // invalidated by the session screen once the placeholder binds to it.
      qc.invalidateQueries({ queryKey: ['conversation'] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
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

  return { sendInput, sendKeys, sendRawKey, cancelSession, addToQueue, removeFromQueue, respondToPlan, respondToQuestion, answerPermission, answerPrompt, setModel, setEffort, adoptSession, resume, forkSession, stopSession: stopSessionMutation }
}
