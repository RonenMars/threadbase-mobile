import { renderHook, act, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useSessionActions } from '@/hooks/useSessionActions'
import { isPromptClosedError, isPromptStaleError, NetworkError } from '@/services/api-client'

const mockPost = jest.fn().mockResolvedValue({})
jest.mock('@/services/api-client', () => {
  const actual = jest.requireActual('@/services/api-client')
  return { ...actual, createApiForServer: () => ({ post: mockPost, delete: jest.fn() }) }
})

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient()
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const vars = { promptId: 'prompt-1', revision: 2, questionId: 'q-1', optionId: 'opt-yes', idempotencyKey: 'key-1' }

async function fire() {
  const { result } = await renderHook(() => useSessionActions('srv1', 'sess1'), { wrapper })
  await act(async () => { result.current.answerPrompt.mutate(vars) })
  await waitFor(() => expect(result.current.answerPrompt.isError || result.current.answerPrompt.isSuccess).toBe(true), { timeout: 10000 })
  return result
}

describe('answerPrompt', () => {
  beforeEach(() => {
    mockPost.mockReset()
    mockPost.mockResolvedValue({})
  })

  it('POSTs the ids, the revision and the idempotency key in the contract shape', async () => {
    await fire()
    expect(mockPost).toHaveBeenCalledWith('/api/sessions/sess1/prompt/answer', {
      promptId: 'prompt-1',
      revision: 2,
      responses: [{ questionId: 'q-1', optionIds: ['opt-yes'] }],
      idempotencyKey: 'key-1',
    })
  })

  // Positive control: retries happen, and every attempt carries the SAME key,
  // which is what makes a retry a replay rather than a second answer.
  it('retries a radio-drop failure with the same idempotency key on every attempt', async () => {
    mockPost.mockRejectedValue(new NetworkError('Failed to reach server'))
    const result = await fire()
    expect(result.current.answerPrompt.isError).toBe(true)
    expect(mockPost).toHaveBeenCalledTimes(3)
    expect(mockPost.mock.calls.map((c) => c[1].idempotencyKey)).toEqual(['key-1', 'key-1', 'key-1'])
  }, 15000)

  it('retries provider_error (the PTY write failed, not the answer)', async () => {
    mockPost.mockRejectedValue(new NetworkError('Server returned 502', 'provider_error'))
    await fire()
    expect(mockPost).toHaveBeenCalledTimes(3)
  }, 15000)

  it.each(['already_resolved', 'prompt_expired', 'prompt_cancelled', 'prompt_unavailable', 'prompt_not_found'])(
    'settles %s as closed on the first reply',
    async (code) => {
      mockPost.mockRejectedValue(new NetworkError('Server returned 409', code))
      const result = await fire()
      expect(mockPost).toHaveBeenCalledTimes(1)
      expect(isPromptClosedError(result.current.answerPrompt.error)).toBe(true)
      expect(isPromptStaleError(result.current.answerPrompt.error)).toBe(false)
    },
    15000,
  )

  it.each(['prompt_revision_mismatch', 'unknown_question', 'unknown_option', 'incomplete_answer', 'unsupported_prompt_shape'])(
    'settles %s as stale on the first reply, not closed',
    async (code) => {
      mockPost.mockRejectedValue(new NetworkError('Server returned 400', code))
      const result = await fire()
      expect(mockPost).toHaveBeenCalledTimes(1)
      expect(isPromptStaleError(result.current.answerPrompt.error)).toBe(true)
      expect(isPromptClosedError(result.current.answerPrompt.error)).toBe(false)
    },
    15000,
  )
})
