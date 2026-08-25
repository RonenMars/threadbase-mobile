import { renderHook, act, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useSessionActions } from '@/hooks/useSessionActions'
import { isAnswerRefusedError, isQuestionClosedError, NetworkError, QUESTION_GONE_CODE } from '@/services/api-client'

const mockPost = jest.fn().mockResolvedValue({})
jest.mock('@/services/api-client', () => {
  const actual = jest.requireActual('@/services/api-client')
  return { ...actual, createApiForServer: () => ({ post: mockPost, delete: jest.fn() }) }
})

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient()
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('respondToQuestion', () => {
  beforeEach(() => {
    mockPost.mockReset()
    mockPost.mockResolvedValue({})
  })

  it('POSTs toolUseId + answers to /answer', async () => {
    const { result } = await renderHook(() => useSessionActions('srv1', 'sess1'), { wrapper })
    await act(async () => {
      result.current.respondToQuestion.mutate({ toolUseId: 't1', answers: { 'Q?': 'A' } })
    })
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/sessions/sess1/answer', { toolUseId: 't1', answers: { 'Q?': 'A' } }))
  })

  // Retries (retryOnNetwork) must exhaust before the mutation settles into an
  // error state — that's what stops the error from surfacing mid-retry.
  it('surfaces the error once retries are exhausted on a genuine failure', async () => {
    mockPost.mockRejectedValue(new NetworkError('Server returned 500'))
    const { result } = await renderHook(() => useSessionActions('srv1', 'sess1'), { wrapper })

    await act(async () => {
      result.current.respondToQuestion.mutate({ toolUseId: 't1', answers: { 'Q?': 'A' } })
    })

    await waitFor(() => expect(result.current.respondToQuestion.isError).toBe(true), { timeout: 10000 })
    expect(result.current.respondToQuestion.error).toBeInstanceOf(NetworkError)
    expect((result.current.respondToQuestion.error as NetworkError).message).toBe('Server returned 500')
    // retry: count < 2 → 1 initial attempt + 2 retries = 3 calls total.
    expect(mockPost).toHaveBeenCalledTimes(3)
  }, 15000)

  // Drives the sequence the SERVER actually produces, not one repeated reply:
  // handleSendAnswer deletes the pending question on its own 409 path, so a
  // second attempt can only answer `no_pending_question`. Retrying here would
  // settle the mutation on that second error and destroy the reason the call
  // sites read — a mock that repeats the 409 hides exactly that.
  it('does not retry a closed question, so the settled error keeps its reason', async () => {
    mockPost
      .mockRejectedValueOnce(new NetworkError('Server returned 409', QUESTION_GONE_CODE))
      .mockRejectedValue(new NetworkError('Server returned 400', 'no_pending_question'))
    const { result } = await renderHook(() => useSessionActions('srv1', 'sess1'), { wrapper })

    await act(async () => {
      result.current.respondToQuestion.mutate({ toolUseId: 't1', answers: { 'Q?': 'A' } })
    })

    await waitFor(() => expect(result.current.respondToQuestion.isError).toBe(true), { timeout: 10000 })
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect((result.current.respondToQuestion.error as NetworkError).code).toBe(QUESTION_GONE_CODE)
    expect(isQuestionClosedError(result.current.respondToQuestion.error)).toBe(true)
  }, 15000)

  // The other two closed-question reasons reach the same benign verdict — they
  // differ only in how the server noticed the question was already unanswerable.
  it.each(['no_pending_question', 'tool_use_mismatch'])(
    'treats %s as a closed question without retrying',
    async (code) => {
      mockPost.mockRejectedValue(new NetworkError('Server returned 400', code))
      const { result } = await renderHook(() => useSessionActions('srv1', 'sess1'), { wrapper })

      await act(async () => {
        result.current.respondToQuestion.mutate({ toolUseId: 't1', answers: { 'Q?': 'A' } })
      })

      await waitFor(() => expect(result.current.respondToQuestion.isError).toBe(true), { timeout: 10000 })
      expect(mockPost).toHaveBeenCalledTimes(1)
      expect(isQuestionClosedError(result.current.respondToQuestion.error)).toBe(true)
    },
    15000,
  )

  // A 400 for an answer shape the server will not write (multi-question form,
  // multi-select, missing answer). Deterministic, so no retry — but the
  // question is still open and answerable in the terminal, so it must NOT read
  // as closed: the card stays up, and `message` is the server's guidance.
  it.each(['unsupported_prompt_shape', 'incomplete_answer'])(
    'settles %s on the first reply, neither retried nor classified as closed',
    async (code) => {
      mockPost.mockRejectedValue(new NetworkError('Answer this one in the terminal', code))
      const { result } = await renderHook(() => useSessionActions('srv1', 'sess1'), { wrapper })

      await act(async () => {
        result.current.respondToQuestion.mutate({ toolUseId: 't1', answers: { 'Q?': 'A' } })
      })

      await waitFor(() => expect(result.current.respondToQuestion.isError).toBe(true), { timeout: 10000 })
      expect(mockPost).toHaveBeenCalledTimes(1)
      expect(isQuestionClosedError(result.current.respondToQuestion.error)).toBe(false)
      expect(isAnswerRefusedError(result.current.respondToQuestion.error)).toBe(true)
      expect((result.current.respondToQuestion.error as NetworkError).message).toBe('Answer this one in the terminal')
    },
    15000,
  )
})
