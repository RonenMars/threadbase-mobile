import { renderHook, act, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useSessionActions } from '@/hooks/useSessionActions'
import { isPromptPendingError, NetworkError, PROMPT_PENDING_CODE } from '@/services/api-client'

const mockPost = jest.fn().mockResolvedValue({})
jest.mock('@/services/api-client', () => {
  const actual = jest.requireActual('@/services/api-client')
  return { ...actual, createApiForServer: () => ({ post: mockPost, delete: jest.fn() }) }
})

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient()
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

// The message the streamer sends with its 409 — shown to the user verbatim.
const PROMPT_PENDING_MESSAGE = 'A prompt is waiting for an answer; answer or dismiss it before sending text'

describe('sendInput', () => {
  beforeEach(() => {
    mockPost.mockReset()
    mockPost.mockResolvedValue({})
  })

  it('POSTs composer text as { input } to /input', async () => {
    const { result } = await renderHook(() => useSessionActions('srv1', 'sess1'), { wrapper })
    await act(async () => {
      result.current.sendInput.mutate('hello')
    })
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/sessions/sess1/input', { input: 'hello' }))
  })

  // Positive control for the two cases below: this harness really does retry.
  // Without it, "called once" would also pass against a mutation that never
  // retried anything.
  it('retries a radio-drop failure before settling (1 attempt + 2 retries)', async () => {
    mockPost.mockRejectedValue(new NetworkError('Failed to reach server'))
    const { result } = await renderHook(() => useSessionActions('srv1', 'sess1'), { wrapper })

    await act(async () => {
      result.current.sendInput.mutate('hello')
    })

    await waitFor(() => expect(result.current.sendInput.isError).toBe(true), { timeout: 10000 })
    expect(mockPost).toHaveBeenCalledTimes(3)
  }, 15000)

  // The server refused the text because a card is open (409 prompt_pending,
  // zero bytes written). Retrying cannot succeed until the card is answered,
  // and each retry only holds the refusal back from the user for another
  // backoff window — so it settles on the first reply, message intact.
  it('does not retry prompt_pending, and settles with the server message', async () => {
    mockPost.mockRejectedValue(new NetworkError(PROMPT_PENDING_MESSAGE, PROMPT_PENDING_CODE))
    const { result } = await renderHook(() => useSessionActions('srv1', 'sess1'), { wrapper })

    await act(async () => {
      result.current.sendInput.mutate('hello')
    })

    await waitFor(() => expect(result.current.sendInput.isError).toBe(true), { timeout: 10000 })
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(isPromptPendingError(result.current.sendInput.error)).toBe(true)
    expect((result.current.sendInput.error as NetworkError).message).toBe(PROMPT_PENDING_MESSAGE)
  }, 15000)

  // Negative control: it is THIS code that stops the retry, not the presence
  // of any code. A coded error from some other route keeps the retry budget.
  it('still retries a coded error that is not prompt_pending', async () => {
    mockPost.mockRejectedValue(new NetworkError('Server returned 409', 'gate_closed'))
    const { result } = await renderHook(() => useSessionActions('srv1', 'sess1'), { wrapper })

    await act(async () => {
      result.current.sendInput.mutate('hello')
    })

    await waitFor(() => expect(result.current.sendInput.isError).toBe(true), { timeout: 10000 })
    expect(mockPost).toHaveBeenCalledTimes(3)
    expect(isPromptPendingError(result.current.sendInput.error)).toBe(false)
  }, 15000)
})
