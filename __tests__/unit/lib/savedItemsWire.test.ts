import {
  favoriteToWire,
  localItemsForServer,
  mergeServerList,
  parseSavedItemsList,
  wireToFavorite,
  type KeyedWireItem,
} from '@/lib/savedItemsWire'
import { buildFavoriteId, type FavoriteItem } from '@/stores/quickAccess'

const session = (serverId: string, id: string, label = id): FavoriteItem => ({
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

describe('favoriteToWire', () => {
  it('keeps dir favorites and favorites without a server on the device', () => {
    expect(favoriteToWire({ type: 'dir', id: '~/app', label: 'app', serverId: 'srv_a' })).toBeNull()
    expect(favoriteToWire({ type: 'session', id: 's', label: 's', serverId: '' })).toBeNull()
  })

  it('derives the key from ids, without the local server id', () => {
    expect(favoriteToWire(session('srv_a', 'abc'))?.key).toBe('session::abc')
    expect(
      favoriteToWire({
        type: 'project-chat',
        id: buildFavoriteId('srv_a', 'project-chat', 'conversation', 'c1'),
        label: 'Chat',
        serverId: 'srv_a',
        chatType: 'conversation',
        chatId: 'c1',
        projectId: 'p1',
      }),
    ).toEqual({
      key: 'project-chat::conversation::c1',
      item: { kind: 'project-chat', label: 'Chat', chatType: 'conversation', chatId: 'c1', projectId: 'p1' },
    })
  })

  it('maps a pre-migration session favorite to the same key as a canonical one', () => {
    const legacy: FavoriteItem = { type: 'session', id: 'srv_a::abc', label: 'Old', serverId: 'srv_a' }
    expect(favoriteToWire(legacy)?.key).toBe(favoriteToWire(session('srv_a', 'abc'))?.key)
  })

  it('round-trips through wireToFavorite', () => {
    const fav = session('srv_a', 'abc', 'Label')
    const wire = favoriteToWire(fav)
    expect(wire && wireToFavorite('srv_a', wire.item)).toEqual(fav)
  })
})

describe('parseSavedItemsList', () => {
  it('skips rows this build does not understand', () => {
    const parsed = parseSavedItemsList({
      revision: 4,
      items: [
        { kind: 'session', label: 'A', sessionId: 'a' },
        { kind: 'workspace', label: 'Future', sessionId: 'x' },
        { kind: 'conversation', label: 'No id' },
        { kind: 'project-chat', label: 'Bad type', chatType: 'thread', chatId: 'c', projectId: 'p' },
        { kind: 'session', label: 'Duplicate', sessionId: 'a' },
      ],
    })
    expect(parsed).toEqual({ items: [remoteSession('a', 'A')], revision: 4 })
  })

  it('reads a missing or malformed body as empty', () => {
    expect(parseSavedItemsList(null)).toEqual({ items: [], revision: 0 })
    expect(parseSavedItemsList({})).toEqual({ items: [], revision: 0 })
  })
})

describe('mergeServerList', () => {
  const dir: FavoriteItem = { type: 'dir', id: '~/app', label: 'app' }
  const other = session('srv_b', 'other')

  it('keeps local ids, and leaves other servers and dirs where they were', () => {
    const legacy: FavoriteItem = { type: 'session', id: 'srv_a::a', label: 'a', serverId: 'srv_a' }
    const local = [legacy, dir, session('srv_a', 'b'), other]

    const merged = mergeServerList(local, 'srv_a', [remoteSession('b', 'B'), remoteSession('a', 'A renamed')])

    expect(merged.map((f) => f.id)).toEqual(['srv_a::session::b', '~/app', 'srv_a::a', 'srv_b::session::other'])
    expect(merged[2]).toMatchObject({ id: 'srv_a::a', label: 'A renamed', sessionId: 'a' })
  })

  it('adds new remote items at the end and drops ones the server no longer has', () => {
    const local = [session('srv_a', 'gone'), dir]
    const merged = mergeServerList(local, 'srv_a', [remoteSession('new')])
    expect(merged.map((f) => f.id)).toEqual(['srv_a::session::new', '~/app'])

    expect(mergeServerList([dir], 'srv_a', [remoteSession('x')]).map((f) => f.id)).toEqual([
      '~/app',
      'srv_a::session::x',
    ])
  })

  it('is a no-op when the server already matches', () => {
    const local = [session('srv_a', 'a'), other]
    expect(mergeServerList(local, 'srv_a', localItemsForServer(local, 'srv_a'))).toEqual(local)
  })
})
