import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePinDir, usePinnedDirs, useUnpinDir } from '@/hooks/usePinnedDirs'
import { useServersStore } from '@/stores/servers'
import type { ServerInfo } from '@/types/api'

const mockGet = jest.fn()
const mockPut = jest.fn()
const mockDelete = jest.fn()
jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({
    get: (...args: [string]) => mockGet(...args),
    put: (...args: [string, unknown]) => mockPut(...args),
    delete: (...args: [string]) => mockDelete(...args),
  }),
}))

const SRV = 'srv_a'

function setServer(pinnedDirs?: boolean) {
  const serverInfo: ServerInfo = {
    version: '1',
    machineName: 'm',
    platform: 'darwin',
    activeSessions: 0,
    ...(pinnedDirs ? { pinnedDirs } : {}),
  }
  useServersStore.setState({
    activeServerIds: [SRV],
    servers: { [SRV]: { id: SRV, url: 'http://tb.example.com', apiKey: 'k', label: 'Mac', isConnected: true, serverInfo } as never },
  })
}

let client: QueryClient
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function useAll() {
  return { list: usePinnedDirs(SRV), pin: usePinDir(SRV), unpin: useUnpinDir(SRV) }
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  mockGet.mockReset()
  mockPut.mockReset()
  mockDelete.mockReset()
})

describe('usePinnedDirs', () => {
  it('is unsupported and never fetches on a server without pinnedDirs', async () => {
    setServer(undefined)
    const { result } = await renderHook(() => usePinnedDirs(SRV), { wrapper })
    expect(result.current).toEqual({ supported: false, dirs: [] })
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('lists the server pins, then pin and unpin update the list in place', async () => {
    setServer(true)
    mockGet.mockResolvedValue({ dirs: [{ path: '/root/a', relativePath: 'a' }] })
    const { result } = await renderHook(useAll, { wrapper })
    await waitFor(() => expect(result.current.list.dirs.map((d) => d.path)).toEqual(['/root/a']))

    mockPut.mockResolvedValue({
      dirs: [
        { path: '/root/a', relativePath: 'a' },
        { path: '/root/b', relativePath: 'b' },
      ],
    })
    await act(async () => {
      await result.current.pin.mutateAsync('b')
    })
    expect(mockPut).toHaveBeenCalledWith('/api/pinned-dirs', { path: 'b' })
    await waitFor(() => expect(result.current.list.dirs.map((d) => d.path)).toEqual(['/root/a', '/root/b']))

    mockDelete.mockResolvedValue({ ok: true, removed: true })
    await act(async () => {
      await result.current.unpin.mutateAsync('/root/a')
    })
    expect(mockDelete).toHaveBeenCalledWith('/api/pinned-dirs?path=%2Froot%2Fa')
    await waitFor(() => expect(result.current.list.dirs.map((d) => d.path)).toEqual(['/root/b']))
  })
})
