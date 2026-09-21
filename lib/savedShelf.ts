import type { Href } from 'expo-router'
import type { ProviderName } from '@/constants/providers'
import { conversationHref } from '@/lib/conversationHref'
import { deriveSessionPresentation } from '@/lib/sessionPresentation'
import { useNavLockStore } from '@/stores/navLock'
import type { FavoriteItem } from '@/stores/quickAccess'
import type { MultiConversation, MultiSession } from '@/types/api'

export type ShelfFavorite = Exclude<FavoriteItem, { type: 'dir' }>

export interface ShelfTarget {
  kind: 'session' | 'conversation'
  serverId: string
  id: string
}

export interface ShelfEntry {
  favorite: ShelfFavorite
  target: ShelfTarget
  needsYou: boolean
  provider?: ProviderName
}

export function isShelfFavorite(fav: FavoriteItem): fav is ShelfFavorite {
  return fav.type !== 'dir'
}

export function shelfTarget(fav: ShelfFavorite): ShelfTarget {
  switch (fav.type) {
    case 'session':
      // Pre-migration session favorites carry no `sessionId`; the id is the last `::` part.
      return { kind: 'session', serverId: fav.serverId, id: fav.sessionId ?? fav.id.split('::').pop() ?? fav.id }
    case 'conversation':
      return { kind: 'conversation', serverId: fav.serverId, id: fav.conversationId }
    case 'project-chat':
      return { kind: fav.chatType, serverId: fav.serverId, id: fav.chatId }
  }
}

function cacheKey(serverId: string, id: string): string {
  return `${serverId}::${id}`
}

export interface ShelfCache {
  sessions: ReadonlyMap<string, MultiSession>
  conversations: ReadonlyMap<string, MultiConversation>
}

export function indexShelfCache(sessions: MultiSession[], conversations: MultiConversation[]): ShelfCache {
  return {
    sessions: new Map(sessions.map((s) => [cacheKey(s.serverId, s.id), s])),
    conversations: new Map(conversations.map((c) => [cacheKey(c.serverId, c.id), c])),
  }
}

/** Saved chats in favorites order, with the ones that need the user moved first. */
export function buildShelfEntries(favorites: FavoriteItem[], cache: ShelfCache): ShelfEntry[] {
  const entries = favorites.filter(isShelfFavorite).map((favorite): ShelfEntry => {
    const target = shelfTarget(favorite)
    const key = cacheKey(target.serverId, target.id)
    if (target.kind === 'session') {
      const session = cache.sessions.get(key)
      return {
        favorite,
        target,
        needsYou: !!session && deriveSessionPresentation(session).tier === 'needsYou',
        provider: session?.provider,
      }
    }
    return { favorite, target, needsYou: false, provider: cache.conversations.get(key)?.provider }
  })
  return [...entries.filter((e) => e.needsYou), ...entries.filter((e) => !e.needsYou)]
}

export function countNeedsYou(entries: ShelfEntry[]): number {
  return entries.filter((e) => e.needsYou).length
}

export function formatBadgeCount(count: number): string {
  if (count <= 0) return ''
  return count > 99 ? '99+' : String(count)
}

export function labelFromCache(target: ShelfTarget, cache: ShelfCache): string | undefined {
  const key = cacheKey(target.serverId, target.id)
  if (target.kind === 'session') {
    const session = cache.sessions.get(key)
    return session?.sessionName ?? session?.projectName
  }
  return cache.conversations.get(key)?.title
}

export function openSavedItem(target: ShelfTarget, router: { push: (href: Href) => void }): void {
  if (target.kind === 'conversation') {
    router.push(conversationHref(target.id, target.serverId))
    return
  }
  useNavLockStore.getState().lock()
  router.push(`/session/${target.id}?server=${target.serverId}`)
}
