import { createSavedItemsSync, type SavedItemsSyncDeps } from '@/lib/savedItemsSync'
import type { KeyedWireItem, WireSavedItem } from '@/lib/savedItemsWire'
import { buildFavoriteId, type FavoriteItem } from '@/stores/quickAccess'

const SRV = 'srv_a'

const session = (id: string, label = id, serverId = SRV): FavoriteItem => ({
  type: 'session',
  id: buildFavoriteId(serverId, 'session', id),
  label,
  serverId,
  sessionId: id,
})

const remoteSession = (id: string, label = id): KeyedWireItem => ({
  key: `session::${id}`,
  item: { kind: 'session', label, sessionId: id },
})

/** An in-memory /api/saved-items with the server's ordering rules. */
function fakeServer(initial: KeyedWireItem[] = []) {
  let items = [...initial]
  let revision = 0
  const calls: string[] = []
  let failNext = false
  const maybeFail = () => {
    if (failNext) {
      failNext = false
      throw new Error('offline')
    }
  }
  return {
    calls,
    get items() {
      return items
    },
    failNextWrite: () => {
      failNext = true
    },
    list: jest.fn(async () => {
      calls.push('list')
      return { items: [...items], revision }
    }),
    put: jest.fn(async (_s: string, key: string, item: WireSavedItem) => {
      maybeFail()
      calls.push(`put ${key}`)
      const at = items.findIndex((i) => i.key === key)
      if (at >= 0) items[at] = { key, item }
      else items.push({ key, item })
      revision++
    }),
    remove: jest.fn(async (_s: string, key: string) => {
      maybeFail()
      calls.push(`delete ${key}`)
      items = items.filter((i) => i.key !== key)
      revision++
    }),
    reorder: jest.fn(async (_s: string, keys: string[]) => {
      maybeFail()
      calls.push(`order ${keys.join(',')}`)
      const listed = keys.map((k) => items.find((i) => i.key === k)).filter((i): i is KeyedWireItem => !!i)
      items = [...listed, ...items.filter((i) => !keys.includes(i.key))]
      revision++
    }),
  }
}

function setup(opts: { server?: ReturnType<typeof fakeServer>; local?: FavoriteItem[]; bootstrapped?: boolean; supports?: boolean } = {}) {
  const server = opts.server ?? fakeServer()
  let favorites = opts.local ?? []
  const bootstrapped = new Set(opts.bootstrapped ? [SRV] : [])
  const onWriteFailed = jest.fn()
  const deps: SavedItemsSyncDeps = {
    list: server.list,
    put: server.put,
    remove: server.remove,
    reorder: server.reorder,
    supports: () => opts.supports ?? true,
    getFavorites: () => favorites,
    setFavorites: (next) => {
      favorites = next
      sync.onLocalChange()
    },
    isBootstrapped: (id) => bootstrapped.has(id),
    markBootstrapped: (id) => bootstrapped.add(id),
    onWriteFailed,
  }
  const sync = createSavedItemsSync(deps)
  const edit = async (next: FavoriteItem[]) => {
    favorites = next
    sync.onLocalChange()
    await sync.idle()
  }
  return { sync, server, onWriteFailed, edit, favorites: () => favorites, bootstrapped }
}

describe('createSavedItemsSync', () => {
  it('uploads local items once when the server starts empty', async () => {
    const dir: FavoriteItem = { type: 'dir', id: '~/app', label: 'app', serverId: SRV }
    const t = setup({ local: [session('a'), dir, session('b'), session('x', 'x', 'srv_other')] })

    await t.sync.pull(SRV)

    expect(t.server.calls).toEqual(['list', 'put session::a', 'put session::b', 'order session::a,session::b'])
    expect(t.bootstrapped.has(SRV)).toBe(true)
  })

  it('lets the server win after the first sync, keeping local ids', async () => {
    const legacy: FavoriteItem = { type: 'session', id: 'srv_a::a', label: 'a', serverId: SRV }
    const t = setup({ server: fakeServer([remoteSession('b'), remoteSession('a', 'A')]), local: [legacy], bootstrapped: true })

    await t.sync.pull(SRV)

    expect(t.favorites().map((f) => [f.id, f.label])).toEqual([
      ['srv_a::session::b', 'b'],
      ['srv_a::a', 'A'],
    ])
    expect(t.server.calls).toEqual(['list'])
  })

  it('does not upload into an emptied server once bootstrapped', async () => {
    const t = setup({ local: [session('a')], bootstrapped: true })
    await t.sync.pull(SRV)
    expect(t.favorites()).toEqual([])
    expect(t.server.put).not.toHaveBeenCalled()
  })

  it('pushes pins, unpins and reorders as the matching calls', async () => {
    const t = setup({ server: fakeServer([remoteSession('a'), remoteSession('b')]), bootstrapped: true })
    await t.sync.pull(SRV)
    t.server.calls.length = 0

    await t.edit([...t.favorites(), session('c')])
    expect(t.server.calls).toEqual(['put session::c'])

    t.server.calls.length = 0
    await t.edit(t.favorites().filter((f) => f.id !== 'srv_a::session::a'))
    expect(t.server.calls).toEqual(['delete session::a'])

    t.server.calls.length = 0
    await t.edit([...t.favorites()].reverse())
    expect(t.server.calls).toEqual(['order session::c,session::b'])
    expect(t.server.items.map((i) => i.key)).toEqual(['session::c', 'session::b'])
  })

  it('rolls the server items back and reports once when a write fails', async () => {
    const other = session('x', 'x', 'srv_other')
    const t = setup({ server: fakeServer([remoteSession('a')]), local: [other], bootstrapped: true })
    await t.sync.pull(SRV)
    const before = t.favorites()

    t.server.failNextWrite()
    await t.edit([...before, session('b')])

    expect(t.favorites().map((f) => f.id)).toEqual(before.map((f) => f.id))
    expect(t.onWriteFailed).toHaveBeenCalledTimes(1)
    expect(t.onWriteFailed).toHaveBeenCalledWith(SRV)
  })

  it('makes no calls for a server without savedItems', async () => {
    const t = setup({ local: [session('a')], supports: false })
    await t.sync.pull(SRV)
    await t.edit([session('a'), session('b')])
    expect(t.server.calls).toEqual([])
  })

  it('does not send back what it just applied from the server', async () => {
    const t = setup({ server: fakeServer([remoteSession('a')]), bootstrapped: true })
    await t.sync.pull(SRV)
    await t.sync.idle()
    expect(t.server.calls).toEqual(['list'])
  })

  it('refetches on a newer remote revision only', async () => {
    const t = setup({ server: fakeServer([remoteSession('a')]), bootstrapped: true })
    await t.sync.pull(SRV)

    t.sync.onRemoteRevision(SRV, 0)
    await t.sync.idle()
    expect(t.server.list).toHaveBeenCalledTimes(1)

    t.sync.onRemoteRevision(SRV, 1)
    await t.sync.idle()
    expect(t.server.list).toHaveBeenCalledTimes(2)
  })
})
