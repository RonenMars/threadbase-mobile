import { buildFavoriteId, type FavoriteItem } from '@/stores/quickAccess'

/**
 * Mapping between local favorites and a streamer's shared saved-items list
 * (`/api/saved-items`). Pure, so the sync rules are testable without a server.
 *
 * The stored key is built from the kind and ids, never from the local
 * `serverId`: that id is a hash of the URL this phone paired with, so another
 * phone — or this one over a tunnel — knows the same streamer by another id.
 */

export type WireSavedItem =
  | { kind: 'session'; label: string; sessionId: string; projectId?: string }
  | { kind: 'conversation'; label: string; conversationId: string; projectId?: string }
  | {
      kind: 'project-chat'
      label: string
      chatType: 'session' | 'conversation'
      chatId: string
      projectId: string
    }

export interface KeyedWireItem {
  key: string
  item: WireSavedItem
}

/** What a server may send; every field is checked before use. */
export interface RawSavedItem {
  key?: string
  kind?: string
  label?: string
  sessionId?: string
  conversationId?: string
  chatType?: string
  chatId?: string
  projectId?: string
}

export interface RawSavedItemsList {
  items?: RawSavedItem[]
  revision?: number
}

export function wireKey(item: WireSavedItem): string {
  switch (item.kind) {
    case 'session':
      return `session::${item.sessionId}`
    case 'conversation':
      return `conversation::${item.conversationId}`
    case 'project-chat':
      return `project-chat::${item.chatType}::${item.chatId}`
  }
}

/** `null` for anything that stays on this device: `dir` items and items without a server. */
export function favoriteToWire(fav: FavoriteItem): KeyedWireItem | null {
  if (fav.type === 'dir' || !fav.serverId) return null
  let item: WireSavedItem
  switch (fav.type) {
    case 'session': {
      // Pre-migration session favorites carry no `sessionId`; the id is the last `::` part.
      const sessionId = fav.sessionId ?? fav.id.split('::').pop() ?? fav.id
      item = { kind: 'session', label: fav.label, sessionId, ...(fav.projectId ? { projectId: fav.projectId } : {}) }
      break
    }
    case 'conversation':
      item = {
        kind: 'conversation',
        label: fav.label,
        conversationId: fav.conversationId,
        ...(fav.projectId ? { projectId: fav.projectId } : {}),
      }
      break
    case 'project-chat':
      item = { kind: 'project-chat', label: fav.label, chatType: fav.chatType, chatId: fav.chatId, projectId: fav.projectId }
      break
  }
  return { key: wireKey(item), item }
}

export function wireToFavorite(serverId: string, item: WireSavedItem): FavoriteItem {
  switch (item.kind) {
    case 'session':
      return {
        type: 'session',
        id: buildFavoriteId(serverId, 'session', item.sessionId),
        label: item.label,
        serverId,
        sessionId: item.sessionId,
        ...(item.projectId ? { projectId: item.projectId } : {}),
      }
    case 'conversation':
      return {
        type: 'conversation',
        id: buildFavoriteId(serverId, 'conversation', item.conversationId),
        label: item.label,
        serverId,
        conversationId: item.conversationId,
        ...(item.projectId ? { projectId: item.projectId } : {}),
      }
    case 'project-chat':
      return {
        type: 'project-chat',
        id: buildFavoriteId(serverId, 'project-chat', item.chatType, item.chatId),
        label: item.label,
        serverId,
        chatType: item.chatType,
        chatId: item.chatId,
        projectId: item.projectId,
      }
  }
}

function nonEmpty(v: string | undefined): v is string {
  return typeof v === 'string' && v.length > 0
}

function parseItem(raw: RawSavedItem): WireSavedItem | null {
  if (!raw || !nonEmpty(raw.label)) return null
  const projectId = nonEmpty(raw.projectId) ? { projectId: raw.projectId } : {}
  switch (raw.kind) {
    case 'session':
      return nonEmpty(raw.sessionId) ? { kind: 'session', label: raw.label, sessionId: raw.sessionId, ...projectId } : null
    case 'conversation':
      return nonEmpty(raw.conversationId)
        ? { kind: 'conversation', label: raw.label, conversationId: raw.conversationId, ...projectId }
        : null
    case 'project-chat':
      if ((raw.chatType !== 'session' && raw.chatType !== 'conversation') || !nonEmpty(raw.chatId) || !nonEmpty(raw.projectId)) {
        return null
      }
      return { kind: 'project-chat', label: raw.label, chatType: raw.chatType, chatId: raw.chatId, projectId: raw.projectId }
    default:
      return null
  }
}

/** A row this build does not understand is skipped, never thrown on. */
export function parseSavedItemsList(raw: RawSavedItemsList | null | undefined): {
  items: KeyedWireItem[]
  revision: number
} {
  const rows = Array.isArray(raw?.items) ? raw.items : []
  const seen = new Set<string>()
  const items: KeyedWireItem[] = []
  for (const row of rows) {
    const item = parseItem(row)
    if (!item) continue
    const key = wireKey(item)
    if (seen.has(key)) continue
    seen.add(key)
    items.push({ key, item })
  }
  const revision = typeof raw?.revision === 'number' && Number.isFinite(raw.revision) ? raw.revision : 0
  return { items, revision }
}

/** This server's syncable items, in local order, first occurrence per key. */
export function localItemsForServer(favorites: FavoriteItem[], serverId: string): KeyedWireItem[] {
  const seen = new Set<string>()
  const out: KeyedWireItem[] = []
  for (const fav of favorites) {
    if (fav.serverId !== serverId) continue
    const wire = favoriteToWire(fav)
    if (!wire || seen.has(wire.key)) continue
    seen.add(wire.key)
    out.push(wire)
  }
  return out
}

/**
 * Make this server's favorites match `remote`, which wins.
 *
 * A remote item that matches a local favorite by key keeps the local `id`, so
 * nothing is re-keyed. The server's items fill, in remote order, the slots its
 * items already held locally; extras go at the end. Other servers' items and
 * `dir` items do not move.
 */
export function mergeServerList(
  favorites: FavoriteItem[],
  serverId: string,
  remote: KeyedWireItem[],
): FavoriteItem[] {
  const localByKey = new Map<string, FavoriteItem>()
  const slots: number[] = []
  favorites.forEach((fav, index) => {
    if (fav.serverId !== serverId) return
    const wire = favoriteToWire(fav)
    if (!wire) return
    slots.push(index)
    if (!localByKey.has(wire.key)) localByKey.set(wire.key, fav)
  })

  const incoming = remote.map(({ key, item }) => {
    const fresh = wireToFavorite(serverId, item)
    const existing = localByKey.get(key)
    return existing ? { ...existing, ...fresh, id: existing.id } : fresh
  })

  const slotSet = new Set(slots)
  const out: FavoriteItem[] = []
  let next = 0
  favorites.forEach((fav, index) => {
    if (!slotSet.has(index)) {
      out.push(fav)
      return
    }
    if (next < incoming.length) out.push(incoming[next++])
  })
  while (next < incoming.length) out.push(incoming[next++])
  return out
}

/** True when two lists hold the same keys, items and order. */
export function sameItems(a: KeyedWireItem[], b: KeyedWireItem[]): boolean {
  return a.length === b.length && a.every((x, i) => x.key === b[i].key && sameItem(x.item, b[i].item))
}

export function sameItem(a: WireSavedItem, b: WireSavedItem): boolean {
  return wireKey(a) === wireKey(b) && a.label === b.label && a.projectId === b.projectId
}
