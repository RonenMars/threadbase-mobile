import { renderHook, act, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useSessionActions } from '@/hooks/useSessionActions'
import { NetworkError } from '@/services/api-client'
import { EFFORT_LEVELS } from '@/constants/models'
import type { Session } from '@/types/api'

const mockPatch = jest.fn().mockResolvedValue({})
jest.mock('@/services/api-client', () => {
  const actual = jest.requireActual('@/services/api-client')
  return { ...actual, createApiForServer: () => ({ patch: mockPatch, post: jest.fn(), delete: jest.fn() }) }
})

const SESSION_KEY = ['session', 'srv1', 'sess1']

const baseSession = {
  id: 'sess1',
  status: 'waiting_input',
  model: 'Opus 4.8 (1M context)',
  effort: 'medium',
} as unknown as Session

async function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(SESSION_KEY, baseSession)
  const invalidateSpy = jest.spyOn(qc, 'invalidateQueries')
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
  const { result } = await renderHook(() => useSessionActions('srv1', 'sess1'), { wrapper })
  return { qc, result, invalidateSpy }
}

describe('setModel', () => {
  beforeEach(() => {
    mockPatch.mockReset()
    mockPatch.mockResolvedValue({})
  })

  it('PATCHes /model with the wire alias', async () => {
    const { result } = await setup()
    await act(async () => { result.current.setModel.mutate('sonnet') })
    await waitFor(() => expect(result.current.setModel.isSuccess).toBe(true))
    expect(mockPatch).toHaveBeenCalledWith('/api/sessions/sess1/model', { model: 'sonnet' })
  })

  it('writes the value optimistically into the session-detail cache', async () => {
    const { qc, result } = await setup()
    await act(async () => { result.current.setModel.mutate('opus') })
    await waitFor(() => expect(result.current.setModel.isSuccess).toBe(true))
    expect(qc.getQueryData<Session>(SESSION_KEY)?.model).toBe('opus')
  })

  it('rolls the optimistic value back when the write fails', async () => {
    mockPatch.mockRejectedValue(new NetworkError('Server returned 500'))
    const { qc, result } = await setup()
    await act(async () => { result.current.setModel.mutate('opus') })
    await waitFor(() => expect(result.current.setModel.isError).toBe(true))
    expect(qc.getQueryData<Session>(SESSION_KEY)?.model).toBe('Opus 4.8 (1M context)')
  })

  it('invalidates the session detail on settle so the scraped value replaces the alias', async () => {
    const { result, invalidateSpy } = await setup()
    await act(async () => { result.current.setModel.mutate('sonnet') })
    await waitFor(() => expect(result.current.setModel.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: SESSION_KEY })
  })

  // The route types bytes into a live PTY, so a silent retry sends the slash
  // command twice.
  it('does not retry a network failure', async () => {
    mockPatch.mockRejectedValue(new NetworkError('Failed to reach server'))
    const { result } = await setup()
    await act(async () => { result.current.setModel.mutate('sonnet') })
    await waitFor(() => expect(result.current.setModel.isError).toBe(true))
    expect(mockPatch).toHaveBeenCalledTimes(1)
  })
})

describe('setEffort', () => {
  beforeEach(() => {
    mockPatch.mockReset()
    mockPatch.mockResolvedValue({})
  })

  it.each(EFFORT_LEVELS)('PATCHes /effort with %s verbatim', async (level) => {
    const { result } = await setup()
    await act(async () => { result.current.setEffort.mutate(level) })
    await waitFor(() => expect(result.current.setEffort.isSuccess).toBe(true))
    expect(mockPatch).toHaveBeenCalledWith('/api/sessions/sess1/effort', { effort: level })
  })

  it.each(['SESSION_IDLE', 'SESSION_BUSY'])('surfaces a 409 %s as a NetworkError carrying the code', async (code) => {
    mockPatch.mockRejectedValue(new NetworkError('Server returned 409', code, undefined, 409))
    const { result } = await setup()
    await act(async () => { result.current.setEffort.mutate('high') })
    await waitFor(() => expect(result.current.setEffort.isError).toBe(true))
    const err = result.current.setEffort.error
    expect(err).toBeInstanceOf(NetworkError)
    expect((err as NetworkError).code).toBe(code)
    expect((err as NetworkError).status).toBe(409)
    expect(mockPatch).toHaveBeenCalledTimes(1)
  })

  it('rolls back the optimistic effort on failure', async () => {
    mockPatch.mockRejectedValue(new NetworkError('Server returned 409', 'SESSION_BUSY', undefined, 409))
    const { qc, result } = await setup()
    await act(async () => { result.current.setEffort.mutate('max') })
    await waitFor(() => expect(result.current.setEffort.isError).toBe(true))
    expect(qc.getQueryData<Session>(SESSION_KEY)?.effort).toBe('medium')
  })
})
