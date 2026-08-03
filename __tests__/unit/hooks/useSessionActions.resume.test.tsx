import { renderHook, act, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useSessionActions } from '@/hooks/useSessionActions'
import { START_SESSION_TIMEOUT_MS } from '@/hooks/useBrowse'

const mockPost = jest.fn().mockResolvedValue({ id: 'sess1' })
jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({ post: mockPost, delete: jest.fn() }),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient()
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('resume', () => {
  it('POSTs with the start-session timeout budget and retry disabled', async () => {
    const { result } = await renderHook(() => useSessionActions('srv1', 'sess1'), { wrapper })
    await act(async () => {
      result.current.resume.mutate({})
    })
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/api/sessions/resume',
        { sessionId: 'sess1' },
        { timeoutMs: START_SESSION_TIMEOUT_MS, retry: false },
      ),
    )
  })
})
