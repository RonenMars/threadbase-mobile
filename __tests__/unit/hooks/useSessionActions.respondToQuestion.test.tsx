import { renderHook, act, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useSessionActions } from '@/hooks/useSessionActions'

const mockPost = jest.fn().mockResolvedValue({})
jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({ post: mockPost, delete: jest.fn() }),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient()
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('respondToQuestion', () => {
  it('POSTs toolUseId + answers to /answer', async () => {
    const { result } = await renderHook(() => useSessionActions('srv1', 'sess1'), { wrapper })
    await act(async () => {
      result.current.respondToQuestion.mutate({ toolUseId: 't1', answers: { 'Q?': 'A' } })
    })
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/sessions/sess1/answer', { toolUseId: 't1', answers: { 'Q?': 'A' } }))
  })
})
