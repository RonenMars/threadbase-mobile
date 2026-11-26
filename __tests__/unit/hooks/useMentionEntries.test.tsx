import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useMentionEntries } from '@/hooks/useMentionEntries'

const mockGet = jest.fn()
jest.mock('@/services/api-client', () => {
  class NetworkError extends Error {
    status?: number
    constructor(message: string, status?: number) {
      super(message)
      this.status = status
    }
  }
  class NotFoundError extends Error {}
  return {
    createApiForServer: () => ({ get: mockGet }),
    NetworkError,
    NotFoundError,
  }
})

let mockServerInfo: { sessionFiles?: true } | undefined
jest.mock('@/stores/servers', () => ({
  useServersStore: (select: (s: unknown) => unknown) =>
    select({ servers: { srv1: { serverInfo: mockServerInfo } } }),
}))

let qc: QueryClient
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const LISTING = { path: '', directories: [{ name: 'src' }], files: [{ name: 'README.md' }] }

describe('useMentionEntries', () => {
  beforeEach(() => {
    qc = new QueryClient()
    mockGet.mockReset()
    mockGet.mockResolvedValue(LISTING)
    mockServerInfo = undefined
  })

  it('lists relative to the session cwd when the server advertises sessionFiles', async () => {
    mockServerInfo = { sessionFiles: true }
    const { result } = await renderHook(() => useMentionEntries('srv1', '/work/proj', 's1', 'src/comp', ''), {
      wrapper,
    })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(mockGet).toHaveBeenCalledWith('/api/sessions/s1/files?dir=src%2Fcomp')
  })

  it('works for a Windows project path, which the browse fallback cannot address', async () => {
    mockServerInfo = { sessionFiles: true }
    const { result } = await renderHook(() => useMentionEntries('srv1', 'C:\\work\\proj', 's1', '', ''), {
      wrapper,
    })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(mockGet).toHaveBeenCalledWith('/api/sessions/s1/files?dir=')
  })

  it('falls back to absolute-path browse when the server does not advertise it', async () => {
    mockServerInfo = {}
    const { result } = await renderHook(() => useMentionEntries('srv1', '/work/proj', 's1', 'src', ''), {
      wrapper,
    })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(mockGet).toHaveBeenCalledWith(`/api/browse?path=${encodeURIComponent('/work/proj/src')}`)
  })

  it('falls back to browse when /api/info has not been read yet', async () => {
    mockServerInfo = undefined
    const { result } = await renderHook(() => useMentionEntries('srv1', '/work/proj', 's1', '', ''), {
      wrapper,
    })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(mockGet).toHaveBeenCalledWith(`/api/browse?path=${encodeURIComponent('/work/proj')}`)
  })

  it('falls back to browse when there is no session id', async () => {
    mockServerInfo = { sessionFiles: true }
    const { result } = await renderHook(() => useMentionEntries('srv1', '/work/proj', undefined, '', ''), {
      wrapper,
    })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(mockGet).toHaveBeenCalledWith(`/api/browse?path=${encodeURIComponent('/work/proj')}`)
  })

  it('keeps ~ paths on browse, which expands them, even when the server advertises sessionFiles', async () => {
    mockServerInfo = { sessionFiles: true }
    const { result } = await renderHook(() => useMentionEntries('srv1', '/work/proj', 's1', '~/dev', ''), {
      wrapper,
    })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(mockGet).toHaveBeenCalledWith(`/api/browse?path=${encodeURIComponent('~/dev')}`)
  })

  it('reports unsupported when the server refuses the listing', async () => {
    mockServerInfo = { sessionFiles: true }
    const { NetworkError } = jest.requireMock('@/services/api-client')
    mockGet.mockRejectedValue(new NetworkError('forbidden', 403))
    const { result } = await renderHook(() => useMentionEntries('srv1', '/work/proj', 's1', '', ''), {
      wrapper,
    })
    await waitFor(() => expect(result.current.status).toBe('unsupported'))
  })

  it('refetches when the picker moves into another directory', async () => {
    mockServerInfo = { sessionFiles: true }
    const { rerender } = await renderHook(
      ({ dir }: { dir: string }) => useMentionEntries('srv1', '/work/proj', 's1', dir, ''),
      { wrapper, initialProps: { dir: '' } },
    )
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/sessions/s1/files?dir='))
    await rerender({ dir: 'src' })
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/sessions/s1/files?dir=src'))
  })

  it('ranks directories and files from the session listing', async () => {
    mockServerInfo = { sessionFiles: true }
    const { result } = await renderHook(() => useMentionEntries('srv1', '/work/proj', 's1', '', 'read'), {
      wrapper,
    })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current).toEqual({ status: 'ready', entries: [{ name: 'README.md', kind: 'file' }] })
  })
})
