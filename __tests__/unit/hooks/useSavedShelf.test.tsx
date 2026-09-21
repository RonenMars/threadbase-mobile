import React from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSavedShelf } from '@/hooks/useSavedShelf'
import { useQuickAccessStore } from '@/stores/quickAccess'
import type { MultiSession } from '@/types/api'

function session(id: string, status: string): MultiSession {
  return { id, serverId: 'srv', status, ptyAttached: true, ownership: 'managed', projectName: 'p' } as MultiSession
}

describe('useSavedShelf', () => {
  let qc: QueryClient
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
    useQuickAccessStore.setState({
      favorites: [
        { type: 'session', id: 'srv::session::a', label: 'A', serverId: 'srv', sessionId: 'a' },
        { type: 'session', id: 'srv::session::b', label: 'B', serverId: 'srv', sessionId: 'b' },
      ],
    })
  })

  it('counts saved sessions that need the user from the cached Hub list, and follows cache updates', async () => {
    qc.setQueryData(['sessions-eager', 'lastActivity', 'desc', '', 'srv', 0], [session('a', 'running'), session('b', 'waiting_input')])
    const { result } = await renderHook(() => useSavedShelf(), { wrapper })
    expect(result.current.needsYouCount).toBe(1)
    expect(result.current.entries[0].favorite.label).toBe('B')

    await act(async () => {
      qc.setQueryData(['sessions-eager', 'lastActivity', 'desc', '', 'srv', 0], [session('a', 'waiting_input'), session('b', 'waiting_input')])
    })
    expect(result.current.needsYouCount).toBe(2)
  })

  it('reads conversation pages from an infinite conversations query', async () => {
    useQuickAccessStore.setState({
      favorites: [{ type: 'conversation', id: 'srv::conversation::c1', label: 'C', serverId: 'srv', conversationId: 'c1' }],
    })
    qc.setQueryData(['conversations', 'srv'], {
      pages: [{ conversations: [{ id: 'c1', serverId: 'srv', title: 'C', provider: 'codex-cli' }] }],
      pageParams: [0],
    })
    const { result } = await renderHook(() => useSavedShelf(), { wrapper })
    expect(result.current.entries[0].provider).toBe('codex-cli')
    expect(result.current.needsYouCount).toBe(0)
  })

  it('never fetches: an empty cache reads as nothing needing the user', async () => {
    const { result } = await renderHook(() => useSavedShelf(), { wrapper })
    expect(result.current.needsYouCount).toBe(0)
    expect(qc.isFetching()).toBe(0)
  })
})
