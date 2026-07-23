import { QueryClient } from '@tanstack/react-query'
import {
  evictStaleConversationFavorite,
  evictStaleSessionFavorite,
  rehydrateSessionAfterReconnect,
  removeSessionFromEagerCache,
} from '@/lib/sessionLifecycle'
import { useQuickAccessStore, buildFavoriteId } from '@/stores/quickAccess'
import type { MultiSession } from '@/types/api'

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
}))

describe('sessionLifecycle', () => {
  beforeEach(() => {
    useQuickAccessStore.setState({ favorites: [] })
  })

  it('removes a vanished session from every eager hub list and detail cache', () => {
    const qc = new QueryClient()
    const row = { serverId: 's1', id: 'sess-1' } as MultiSession
    const other = { serverId: 's1', id: 'sess-2' } as MultiSession
    qc.setQueryData(['sessions-eager', 's1'], [row, other])
    qc.setQueryData(['session', 's1', 'sess-1'], row)

    removeSessionFromEagerCache(qc, 's1', 'sess-1')

    expect(qc.getQueryData(['sessions-eager', 's1'])).toEqual([other])
    expect(qc.getQueryData(['session', 's1', 'sess-1'])).toBeUndefined()
  })

  it('evicts canonical and legacy session favorites for a vanished id', () => {
    const canonical = buildFavoriteId('s1', 'session', 'gone')
    useQuickAccessStore.setState({
      favorites: [
        { type: 'session', id: canonical, label: 'A', serverId: 's1', sessionId: 'gone' },
        { type: 'session', id: 'legacy::gone', label: 'B', serverId: 's1' },
        { type: 'session', id: buildFavoriteId('s1', 'session', 'keep'), label: 'C', serverId: 's1', sessionId: 'keep' },
        { type: 'dir', id: '/tmp', label: 'dir' },
      ],
    })

    evictStaleSessionFavorite('s1', 'gone')

    const left = useQuickAccessStore.getState().favorites
    expect(left.map((f) => f.id)).toEqual([
      buildFavoriteId('s1', 'session', 'keep'),
      '/tmp',
    ])
  })

  it('evicts conversation favorites for a vanished conversation id', () => {
    const canonical = buildFavoriteId('s1', 'conversation', 'c-gone')
    useQuickAccessStore.setState({
      favorites: [
        { type: 'conversation', id: canonical, label: 'A', serverId: 's1', conversationId: 'c-gone' },
        {
          type: 'conversation',
          id: buildFavoriteId('s1', 'conversation', 'c-keep'),
          label: 'B',
          serverId: 's1',
          conversationId: 'c-keep',
        },
      ],
    })

    evictStaleConversationFavorite('s1', 'c-gone')

    expect(useQuickAccessStore.getState().favorites.map((f) => f.conversationId)).toEqual(['c-keep'])
  })

  it('rehydrates session and bound conversation queries after reconnect', () => {
    const qc = new QueryClient()
    const invalidate = jest.spyOn(qc, 'invalidateQueries')

    rehydrateSessionAfterReconnect(qc, 's1', 'sess-1', 'conv-9')

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['session', 's1', 'sess-1'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['conversation', 's1', 'conv-9'] })
  })

  it('skips conversation invalidation when no conversation id is known', () => {
    const qc = new QueryClient()
    const invalidate = jest.spyOn(qc, 'invalidateQueries')

    rehydrateSessionAfterReconnect(qc, 's1', 'sess-1', null)

    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['session', 's1', 'sess-1'] })
  })
})
