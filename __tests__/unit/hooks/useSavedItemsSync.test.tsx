import { act, renderHook } from '@testing-library/react-native'
import { useSavedItemsSync } from '@/hooks/useSavedItemsSync'
import {
  deleteSavedItem,
  listSavedItems,
  putSavedItem,
  reorderSavedItems,
} from '@/services/saved-items'
import { useAlertStore } from '@/stores/alerts'
import { buildFavoriteId, useQuickAccessStore, type FavoriteItem } from '@/stores/quickAccess'
import { useServersStore } from '@/stores/servers'
import type { ServerInfo } from '@/types/api'

jest.mock('@/services/saved-items', () => {
  const { useServersStore: servers } = jest.requireActual('@/stores/servers')
  return {
    serverSupportsSavedItems: (id: string) => servers.getState().servers[id]?.serverInfo?.savedItems === true,
    listSavedItems: jest.fn(async () => ({ items: [], revision: 0 })),
    putSavedItem: jest.fn(async () => {}),
    deleteSavedItem: jest.fn(async () => {}),
    reorderSavedItems: jest.fn(async () => {}),
  }
})

const mockWsHandlers = new Map<string, (msg: { type: string; serverId: string; revision?: number }) => void>()
jest.mock('@/services/ws-client', () => ({
  wsManager: {
    onAll: (type: string, handler: (msg: { type: string; serverId: string; revision?: number }) => void) => {
      mockWsHandlers.set(type, handler)
      return () => mockWsHandlers.delete(type)
    },
  },
}))

const mockList = listSavedItems as jest.MockedFunction<typeof listSavedItems>
const mockPut = putSavedItem as jest.MockedFunction<typeof putSavedItem>

const SRV = 'srv_a'
const info = (savedItems?: boolean): ServerInfo =>
  ({ version: '1', machineName: 'm', platform: 'darwin', activeSessions: 0, ...(savedItems ? { savedItems } : {}) })

const session = (id: string): FavoriteItem => ({
  type: 'session',
  id: buildFavoriteId(SRV, 'session', id),
  label: id,
  serverId: SRV,
  sessionId: id,
})

function setServer(savedItems: boolean | undefined, isConnected = true) {
  useServersStore.setState({
    activeServerIds: [SRV],
    servers: {
      [SRV]: {
        id: SRV,
        url: 'http://tb.example.com',
        apiKey: 'k',
        label: 'Mac',
        isConnected,
        serverInfo: info(savedItems),
      } as never,
    },
  })
}

const flush = () => act(async () => {
  await new Promise((r) => setTimeout(r, 0))
})

beforeEach(() => {
  jest.clearAllMocks()
  mockWsHandlers.clear()
  useAlertStore.getState().reset()
  useQuickAccessStore.setState({ favorites: [session('a')], hydrated: true, savedItemsBootstrapped: [SRV] })
})

describe('useSavedItemsSync', () => {
  it('makes no calls when the server does not report savedItems', async () => {
    setServer(undefined)
    await renderHook(() => useSavedItemsSync())
    await act(async () => {
      useQuickAccessStore.getState().pinItem(session('b'))
    })
    await flush()

    expect(mockList).not.toHaveBeenCalled()
    expect(mockPut).not.toHaveBeenCalled()
  })

  it('waits for the favorites to hydrate before the first pull', async () => {
    setServer(true)
    useQuickAccessStore.setState({ hydrated: false })
    await renderHook(() => useSavedItemsSync())
    await flush()
    expect(mockList).not.toHaveBeenCalled()

    await act(async () => {
      useQuickAccessStore.setState({ hydrated: true })
    })
    await flush()
    expect(mockList).toHaveBeenCalledWith(SRV)
  })

  it('pushes a pin to a capable server', async () => {
    setServer(true)
    mockList.mockResolvedValueOnce({
      items: [{ key: 'session::a', item: { kind: 'session', label: 'a', sessionId: 'a' } }],
      revision: 1,
    })
    await renderHook(() => useSavedItemsSync())
    await flush()

    await act(async () => {
      useQuickAccessStore.getState().pinItem(session('b'))
    })
    await flush()

    expect(mockPut).toHaveBeenCalledWith(SRV, 'session::b', { kind: 'session', label: 'b', sessionId: 'b' })
    expect(deleteSavedItem).not.toHaveBeenCalled()
    expect(reorderSavedItems).not.toHaveBeenCalled()
  })

  it('rolls back a failed pin and raises one alert', async () => {
    setServer(true)
    mockList.mockResolvedValueOnce({
      items: [{ key: 'session::a', item: { kind: 'session', label: 'a', sessionId: 'a' } }],
      revision: 1,
    })
    mockPut.mockRejectedValueOnce(new Error('offline'))
    await renderHook(() => useSavedItemsSync())
    await flush()

    await act(async () => {
      useQuickAccessStore.getState().pinItem(session('b'))
    })
    await flush()

    expect(useQuickAccessStore.getState().favorites.map((f) => f.id)).toEqual(['srv_a::session::a'])
    expect(useAlertStore.getState().alerts.filter((a) => a.id === `saved-items-sync:${SRV}`)).toHaveLength(1)
  })

  it('refetches when another device changes the list', async () => {
    setServer(true)
    await renderHook(() => useSavedItemsSync())
    await flush()
    expect(mockList).toHaveBeenCalledTimes(1)

    await act(async () => {
      mockWsHandlers.get('saved_items_changed')?.({ type: 'saved_items_changed', serverId: SRV, revision: 5 })
    })
    await flush()
    expect(mockList).toHaveBeenCalledTimes(2)
  })
})
