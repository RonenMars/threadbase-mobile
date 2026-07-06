import { renderHook, act, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import React from 'react'
import { useSessionActions } from '@/hooks/useSessionActions'

const mockPost = jest.fn().mockResolvedValue({})
jest.mock('@/services/api-client', () => {
  class NetworkError extends Error {}
  return {
    createApiForServer: () => ({ post: mockPost, delete: jest.fn() }),
    NetworkError,
  }
})

let qc: QueryClient
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('sendInput offline pause + reconnect resume', () => {
  beforeEach(() => {
    qc = new QueryClient()
    mockPost.mockClear()
    onlineManager.setOnline(true)
  })

  afterEach(() => {
    onlineManager.setOnline(true)
  })

  it('pauses the send while offline (mutationFn never runs) and replays on reconnect', async () => {
    const { result } = await renderHook(() => useSessionActions('srv1', 'sess1'), { wrapper })

    onlineManager.setOnline(false)
    await act(async () => {
      result.current.sendInput.mutate('hello')
    })

    // networkMode 'online' parks the mutation before the fetch — no POST yet.
    await waitFor(() => expect(result.current.sendInput.isPaused).toBe(true))
    expect(mockPost).not.toHaveBeenCalled()

    // Reconnect and replay: the original closure fires exactly once.
    onlineManager.setOnline(true)
    await act(async () => {
      await qc.resumePausedMutations()
    })

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/sessions/sess1/input', { input: 'hello' }),
    )
    expect(mockPost).toHaveBeenCalledTimes(1)
  })
})
