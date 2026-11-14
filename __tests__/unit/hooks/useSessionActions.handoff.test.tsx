import { renderHook, act, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useSessionActions } from '@/hooks/useSessionActions'
import { NetworkError, NotFoundError } from '@/services/api-client'

const mockHandoffSession = jest.fn()
jest.mock('@/services/api-client', () => {
  const actual = jest.requireActual('@/services/api-client')
  return { ...actual, handoffSession: (...args: [string, string]) => mockHandoffSession(...args) }
})

async function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidateSpy = jest.spyOn(qc, 'invalidateQueries')
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
  const { result } = await renderHook(() => useSessionActions('srv1', 'sess1'), { wrapper })
  return { result, invalidateSpy }
}

describe('handoff', () => {
  beforeEach(() => mockHandoffSession.mockReset())

  it.each([
    ['success', () => mockHandoffSession.mockResolvedValue({ status: 'handed_off' })],
    ['HANDOFF_LAUNCH_FAILED', () => mockHandoffSession.mockRejectedValue(new NetworkError('tmux', 'HANDOFF_LAUNCH_FAILED', undefined, 500))],
    ['404', () => mockHandoffSession.mockRejectedValue(new NotFoundError('/api/sessions/sess1/handoff'))],
  ])('refreshes the session lists after %s', async (_label, arrange) => {
    arrange()
    const { result, invalidateSpy } = await setup()
    await act(async () => { await result.current.handoff.mutateAsync().catch(() => {}) })
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['sessions'] }))
    expect(mockHandoffSession).toHaveBeenCalledWith('srv1', 'sess1')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['session', 'srv1', 'sess1'] })
  })
})
