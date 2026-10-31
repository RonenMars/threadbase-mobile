import React from 'react'
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRecentDirs } from '@/hooks/useRecentDirs'
import { useServersStore } from '@/stores/servers'
import type { ServerInfo } from '@/types/api'

const mockGet = jest.fn()
jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({ get: (...args: [string]) => mockGet(...args) }),
}))

const mockSessions: { current: { serverId: string; projectPath: string; startedAt: string }[] } = { current: [] }
jest.mock('@/hooks/useSession', () => ({
  useSessions: () => ({ data: mockSessions.current }),
}))

const SRV = 'srv_a'

function setServer(recentDirs?: boolean) {
  const serverInfo: ServerInfo = {
    version: '1',
    machineName: 'm',
    platform: 'darwin',
    activeSessions: 0,
    ...(recentDirs ? { recentDirs } : {}),
  }
  useServersStore.setState({
    activeServerIds: [SRV],
    servers: { [SRV]: { id: SRV, url: 'http://tb.example.com', apiKey: 'k', label: 'Mac', isConnected: true, serverInfo } as never },
  })
}

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  mockGet.mockReset()
  mockSessions.current = [{ serverId: SRV, projectPath: '/live', startedAt: '2026-10-01T00:00:00.000Z' }]
})

describe('useRecentDirs', () => {
  it('uses only live sessions on a server without recentDirs', async () => {
    setServer(undefined)
    const { result } = await renderHook(() => useRecentDirs(SRV, 8), { wrapper })
    expect(result.current.map((d) => d.path)).toEqual(['/live'])
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('shows directories the server recorded before a restart', async () => {
    setServer(true)
    mockGet.mockResolvedValue({ dirs: [{ path: '/before-restart', lastUsedAt: '2026-10-02T00:00:00.000Z' }] })
    const { result } = await renderHook(() => useRecentDirs(SRV, 8), { wrapper })

    await waitFor(() => expect(result.current.map((d) => d.path)).toEqual(['/before-restart', '/live']))
    expect(mockGet).toHaveBeenCalledWith('/api/recent-dirs', expect.anything())
  })

  it('keeps the live list when the fetch fails', async () => {
    setServer(true)
    mockGet.mockRejectedValue(new Error('offline'))
    const { result } = await renderHook(() => useRecentDirs(SRV, 8), { wrapper })
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(result.current.map((d) => d.path)).toEqual(['/live'])
  })
})
