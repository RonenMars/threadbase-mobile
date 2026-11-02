import type { FavoriteItem } from '@/stores/quickAccess'
import {
  localItemsForServer,
  mergeServerList,
  sameItem,
  sameItems,
  type KeyedWireItem,
  type WireSavedItem,
} from '@/lib/savedItemsWire'

export interface SavedItemsSyncDeps {
  list: (serverId: string) => Promise<{ items: KeyedWireItem[]; revision: number }>
  put: (serverId: string, key: string, item: WireSavedItem) => Promise<void>
  remove: (serverId: string, key: string) => Promise<void>
  reorder: (serverId: string, keys: string[]) => Promise<void>
  supports: (serverId: string) => boolean
  getFavorites: () => FavoriteItem[]
  setFavorites: (favorites: FavoriteItem[]) => void
  isBootstrapped: (serverId: string) => boolean
  markBootstrapped: (serverId: string) => void
  onWriteFailed: (serverId: string) => void
}

export interface SavedItemsSync {
  /** Fetch the server's list and make it win for that server's items. */
  pull: (serverId: string) => Promise<void>
  /** Push the local edit to every synced server it touched. */
  onLocalChange: () => void
  onRemoteRevision: (serverId: string, revision: number) => void
  /** Wait for every queued job; for tests. */
  idle: () => Promise<void>
}

/**
 * The local favorites stay the list the UI reads; each capable server is
 * reconciled against it.
 *
 * Per server, `synced` holds the list last known to match the server. A local
 * edit is diffed against it and sent as upserts, deletes and one reorder; a
 * failure puts that server's items back to `synced` and raises one alert.
 * There is no offline queue. Jobs for one server run one at a time, in order,
 * so a pull never interleaves with a push.
 */
export function createSavedItemsSync(deps: SavedItemsSyncDeps): SavedItemsSync {
  const synced = new Map<string, KeyedWireItem[]>()
  const revisions = new Map<string, number>()
  const chains = new Map<string, Promise<void>>()
  let applyingRemote = false
  let localVersion = 0

  const enqueue = (serverId: string, job: () => Promise<void>): Promise<void> => {
    const next = (chains.get(serverId) ?? Promise.resolve()).then(job).catch(() => {})
    chains.set(serverId, next)
    return next
  }

  const applyRemote = (favorites: FavoriteItem[]) => {
    applyingRemote = true
    try {
      deps.setFavorites(favorites)
    } finally {
      applyingRemote = false
    }
  }

  const pullNow = async (serverId: string) => {
    if (!deps.supports(serverId)) return
    const versionAtStart = localVersion
    const { items, revision } = await deps.list(serverId)

    // An edit landed while the list was in flight. Its push is queued behind
    // this job; let it go first, then look again, rather than overwrite it.
    if (localVersion !== versionAtStart && synced.has(serverId)) {
      void enqueue(serverId, () => pullNow(serverId))
      return
    }

    const local = localItemsForServer(deps.getFavorites(), serverId)
    if (items.length === 0 && local.length > 0 && !deps.isBootstrapped(serverId)) {
      for (const { key, item } of local) await deps.put(serverId, key, item)
      await deps.reorder(serverId, local.map((l) => l.key))
      synced.set(serverId, local)
      deps.markBootstrapped(serverId)
      return
    }

    deps.markBootstrapped(serverId)
    revisions.set(serverId, revision)
    synced.set(serverId, items)
    if (!sameItems(local, items)) applyRemote(mergeServerList(deps.getFavorites(), serverId, items))
  }

  const pushNow = async (serverId: string) => {
    const base = synced.get(serverId)
    if (!base || !deps.supports(serverId)) return
    const current = localItemsForServer(deps.getFavorites(), serverId)
    if (sameItems(base, current)) return

    const baseByKey = new Map(base.map((b) => [b.key, b]))
    const currentKeys = new Set(current.map((c) => c.key))
    try {
      for (const c of current) {
        const before = baseByKey.get(c.key)
        if (!before || !sameItem(before.item, c.item)) await deps.put(serverId, c.key, c.item)
      }
      for (const b of base) {
        if (!currentKeys.has(b.key)) await deps.remove(serverId, b.key)
      }
      // The server appends new keys, so this is its order after the writes above.
      const serverOrder = [
        ...base.filter((b) => currentKeys.has(b.key)).map((b) => b.key),
        ...current.filter((c) => !baseByKey.has(c.key)).map((c) => c.key),
      ]
      const wanted = current.map((c) => c.key)
      if (serverOrder.some((key, i) => key !== wanted[i])) await deps.reorder(serverId, wanted)
      synced.set(serverId, current)
    } catch {
      applyRemote(mergeServerList(deps.getFavorites(), serverId, base))
      deps.onWriteFailed(serverId)
    }
  }

  return {
    pull: (serverId) => enqueue(serverId, () => pullNow(serverId)),

    onLocalChange: () => {
      if (applyingRemote) return
      localVersion++
      for (const serverId of synced.keys()) {
        void enqueue(serverId, () => pushNow(serverId))
      }
    },

    onRemoteRevision: (serverId, revision) => {
      if (!synced.has(serverId)) return
      if (revision > (revisions.get(serverId) ?? -1)) void enqueue(serverId, () => pullNow(serverId))
    },

    idle: async () => {
      // A job can enqueue another; settle until the chains stop growing.
      let pending: Promise<void>[] = []
      do {
        pending = [...chains.values()]
        await Promise.all(pending)
      } while ([...chains.values()].some((p, i) => p !== pending[i]))
    },
  }
}
