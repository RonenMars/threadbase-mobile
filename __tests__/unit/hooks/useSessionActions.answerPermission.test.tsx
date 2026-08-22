import { renderHook, act, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useSessionActions } from '@/hooks/useSessionActions'
import { isPermissionClosedError, NetworkError, NotFoundError } from '@/services/api-client'

const mockPost = jest.fn().mockResolvedValue({})
jest.mock('@/services/api-client', () => {
  const actual = jest.requireActual('@/services/api-client')
  return { ...actual, createApiForServer: () => ({ post: mockPost, delete: jest.fn() }) }
})

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient()
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

// A real key, captured from a permission payload rather than written by hand.
// The format is the server's to change; asserting its shape here would fail as
// a contract break the day permissionContentKey is rewritten.
const CONTENT_KEY = 'Do you want to proceed?::Bash command::1.Yes,2.No'

const answer = (over: Partial<{ contentKey?: string; optionIndex: number; keys: string | null }> = {}) => ({
  contentKey: CONTENT_KEY,
  optionIndex: 0,
  keys: '1\r',
  ...over,
})

async function setup() {
  return renderHook(() => useSessionActions('srv1', 'sess1'), { wrapper })
}

describe('answerPermission – validated route', () => {
  beforeEach(() => {
    mockPost.mockReset()
    mockPost.mockResolvedValue({})
  })

  it('POSTs the content key and the option position, and no keystrokes', async () => {
    const { result } = await setup()
    await act(async () => {
      result.current.answerPermission.mutate(answer({ optionIndex: 1 }))
    })

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith(
      '/api/sessions/sess1/permission/answer',
      { contentKey: CONTENT_KEY, optionIndex: 1 },
    ))
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  // The position in the options array as broadcast, never the on-screen number.
  // A gate numbering its rows "2. Yes / 3. No" is where those two diverge, and
  // the server owns the mapping from one to the other.
  it('sends the array position even when the gate numbers its options from 2', async () => {
    const { result } = await setup()
    await act(async () => {
      result.current.answerPermission.mutate(answer({ optionIndex: 0, keys: '2\r' }))
    })

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith(
      '/api/sessions/sess1/permission/answer',
      { contentKey: CONTENT_KEY, optionIndex: 0 },
    ))
  })
})

describe('answerPermission – fallback to /input', () => {
  beforeEach(() => {
    mockPost.mockReset()
    mockPost.mockResolvedValue({})
  })

  // Trigger 1. A streamer that sends no contentKey cannot have the route, so
  // spending a round trip to discover that is pure latency.
  it('goes straight to /input when the gate carried no content key', async () => {
    const { result } = await setup()
    await act(async () => {
      result.current.answerPermission.mutate(answer({ contentKey: undefined, keys: 'y' }))
    })

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/sessions/sess1/input', { keys: 'y' }))
    expect(mockPost).not.toHaveBeenCalledWith(
      '/api/sessions/sess1/permission/answer',
      expect.anything(),
    )
  })

  // Trigger 2. Old server with a contentKey it never sent — or any 404 — lands
  // here. Sequenced, not repeated: the fallback must succeed on the second call,
  // which a single mockRejectedValue could never show.
  it('falls back to /input when the validated route is absent', async () => {
    mockPost
      .mockRejectedValueOnce(new NotFoundError('/api/sessions/sess1/permission/answer'))
      .mockResolvedValue({})
    const { result } = await setup()

    await act(async () => {
      result.current.answerPermission.mutate(answer({ keys: '\x1b' }))
    })

    await waitFor(() => expect(result.current.answerPermission.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenNthCalledWith(1, '/api/sessions/sess1/permission/answer', { contentKey: CONTENT_KEY, optionIndex: 0 })
    expect(mockPost).toHaveBeenNthCalledWith(2, '/api/sessions/sess1/input', { keys: '\x1b' })
  })

  // The Codex EXEC case: the detector's literal keys win over the on-screen
  // number, and the fallback is the only path where the client picks bytes at
  // all now, so this is where that has to be true.
  it('sends the literal answer keys the caller computed, not an index', async () => {
    mockPost
      .mockRejectedValueOnce(new NotFoundError('/api/sessions/sess1/permission/answer'))
      .mockResolvedValue({})
    const { result } = await setup()

    await act(async () => {
      result.current.answerPermission.mutate(answer({ keys: 'y' }))
    })

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/sessions/sess1/input', { keys: 'y' }))
  })

  it('fails rather than guessing when the option carries no keys at all', async () => {
    const { result } = await setup()
    await act(async () => {
      result.current.answerPermission.mutate(answer({ contentKey: undefined, keys: null }))
    })

    await waitFor(() => expect(result.current.answerPermission.isError).toBe(true), { timeout: 10000 })
    expect(mockPost).not.toHaveBeenCalled()
    expect(isPermissionClosedError(result.current.answerPermission.error)).toBe(false)
    // This throw never touched the network, so it must settle on the first
    // attempt — failureCount stays 1 rather than the 3 a retried mutation reaches.
    expect(result.current.answerPermission.failureCount).toBe(1)
  }, 15000)
})

describe('answerPermission – error classification', () => {
  beforeEach(() => {
    mockPost.mockReset()
    mockPost.mockResolvedValue({})
  })

  it.each(['gate_closed', 'gate_mismatch', 'unknown_option'])(
    'settles %s as closed on the first reply, without retrying',
    async (reason) => {
      mockPost.mockRejectedValue(new NetworkError('Server returned 409', reason))
      const { result } = await setup()

      await act(async () => {
        result.current.answerPermission.mutate(answer())
      })

      await waitFor(() => expect(result.current.answerPermission.isError).toBe(true))
      expect(isPermissionClosedError(result.current.answerPermission.error)).toBe(true)
      expect(mockPost).toHaveBeenCalledTimes(1)
    },
  )

  // 400 carries a free-text reason, not one of the three enum values. It must
  // fall through to retryable: an unrecognised code keeps the card, because
  // dismissing a card whose gate is still open is the expensive mistake.
  it('treats a 400 with a free-text reason as retryable, not closed', async () => {
    mockPost.mockRejectedValue(new NetworkError('Server returned 400', 'optionIndex must be a number'))
    const { result } = await setup()

    await act(async () => {
      result.current.answerPermission.mutate(answer())
    })

    await waitFor(() => expect(result.current.answerPermission.isError).toBe(true), { timeout: 10000 })
    expect(isPermissionClosedError(result.current.answerPermission.error)).toBe(false)
    // 1 attempt + 2 retries, the same budget every other retryable send gets.
    expect(mockPost).toHaveBeenCalledTimes(3)
  }, 15000)

  it('treats a 500 as retryable', async () => {
    mockPost.mockRejectedValue(new NetworkError('Server returned 500'))
    const { result } = await setup()

    await act(async () => {
      result.current.answerPermission.mutate(answer())
    })

    await waitFor(() => expect(result.current.answerPermission.isError).toBe(true), { timeout: 10000 })
    expect(isPermissionClosedError(result.current.answerPermission.error)).toBe(false)
    expect(mockPost).toHaveBeenCalledTimes(3)
  }, 15000)
})
