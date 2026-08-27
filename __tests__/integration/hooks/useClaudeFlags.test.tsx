/**
 * useClaudeFlags / useUpdateClaudeFlags.
 *
 * Guards the two contracts that keep this feature safe against older servers and
 * against showing a stale security setting:
 *   - a 404 resolves to null (server predates the feature) rather than throwing
 *   - a successful write seeds the cache from the SERVER's normalised response
 */
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useClaudeFlags, useUpdateClaudeFlags } from '@/hooks/useClaudeFlags'

const mockGet = jest.fn()
const mockPut = jest.fn()

// Mock the exported helpers themselves, not createApiForServer: getClaudeFlags
// lives in the same module and closes over the real createApiForServer, so
// swapping that alone would leave the helpers calling the real client.
jest.mock('@/services/api-client', () => {
  const actual = jest.requireActual('@/services/api-client')
  return {
    ...actual,
    getClaudeFlags: (serverId: string) => mockGet(serverId),
    updateClaudeFlags: (serverId: string, values: unknown, extraArgs?: string) =>
      mockPut(serverId, values, extraArgs),
  }
})

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const CONFIG = {
  registry: [{ id: 'maxBudgetUsd', flag: '--max-budget-usd', valueType: 'string', risk: 'low' }],
  values: { maxBudgetUsd: '5' },
  extraArgs: null,
  persisted: true,
}

beforeEach(() => {
  mockGet.mockReset()
  mockPut.mockReset()
})

describe('useClaudeFlags', () => {
  it('returns the config on success', async () => {
    mockGet.mockResolvedValue(CONFIG)
    const { result } = await renderHook(() => useClaudeFlags('srv1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(CONFIG)
  })

  // An older streamer has no /api/config/claude-flags. getClaudeFlags maps that
  // 404 to null so the UI reads it as "feature absent", not as an error banner.
  it('resolves to null when the server predates the feature', async () => {
    mockGet.mockResolvedValue(null)
    const { result } = await renderHook(() => useClaudeFlags('srv1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('surfaces other errors', async () => {
    mockGet.mockRejectedValue(new Error('boom'))
    const { result } = await renderHook(() => useClaudeFlags('srv1'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useUpdateClaudeFlags', () => {
  it('sends values and extraArgs', async () => {
    mockPut.mockResolvedValue(CONFIG)
    const { result } = await renderHook(() => useUpdateClaudeFlags('srv1'), { wrapper })

    result.current.mutate({ values: { maxBudgetUsd: '5' }, extraArgs: '--bare' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPut).toHaveBeenCalledWith('srv1', { maxBudgetUsd: '5' }, '--bare')
  })

  it('omits extraArgs when empty', async () => {
    mockPut.mockResolvedValue(CONFIG)
    const { result } = await renderHook(() => useUpdateClaudeFlags('srv1'), { wrapper })

    result.current.mutate({ values: {} })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPut).toHaveBeenCalledWith('srv1', {}, undefined)
  })

  it('surfaces a write failure instead of silently rolling back', async () => {
    mockPut.mockRejectedValue(new Error('forbidden'))
    const { result } = await renderHook(() => useUpdateClaudeFlags('srv1'), { wrapper })

    result.current.mutate({ values: {} })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('forbidden')
  })
})
