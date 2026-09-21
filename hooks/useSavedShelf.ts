import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  buildShelfEntries,
  countNeedsYou,
  indexShelfCache,
  type ShelfCache,
  type ShelfEntry,
} from '@/lib/savedShelf'
import { useQuickAccessStore } from '@/stores/quickAccess'
import type { MultiConversation, MultiSession } from '@/types/api'

// The three shapes `['conversations', …]` queries hold (see services/query-client.ts).
type ConversationCacheData =
  | MultiConversation[]
  | { conversations: MultiConversation[] }
  | { pages: { conversations: MultiConversation[] }[] }

const SOURCE_KEYS = new Set(['sessions-eager', 'conversations'])

// One snapshot per client, dropped on every relevant cache change so
// useSyncExternalStore sees a stable object between changes.
const snapshots = new WeakMap<QueryClient, ShelfCache>()

function conversationsOf(data: ConversationCacheData | undefined): MultiConversation[] {
  if (!data) return []
  if (Array.isArray(data)) return data
  if ('pages' in data) return Array.isArray(data.pages) ? data.pages.flatMap((p) => p?.conversations ?? []) : []
  return Array.isArray(data.conversations) ? data.conversations : []
}

function readShelfCache(qc: QueryClient): ShelfCache {
  const sessions = qc
    .getQueriesData<MultiSession[]>({ queryKey: ['sessions-eager'] })
    .flatMap(([, data]) => (Array.isArray(data) ? data : []))
  const conversations = qc
    .getQueriesData<ConversationCacheData>({ queryKey: ['conversations'] })
    .flatMap(([, data]) => conversationsOf(data))
  return indexShelfCache(sessions, conversations)
}

export interface SavedShelf {
  entries: ShelfEntry[]
  needsYouCount: number
  cache: ShelfCache
}

/**
 * Saved sessions and conversations for the chat shelf, read passively from the
 * lists the Hub already keeps fetched and the WebSocket keeps patched. It never
 * starts a fetch: mounting `useEagerSessions` at the root would run a second
 * full paginated load per server.
 *
 * ponytail: a saved session missing from every cached list counts as not
 * needing the user; add a `['session', serverId, id]` lookup if that shows up.
 */
export function useSavedShelf(): SavedShelf {
  const qc = useQueryClient()
  const favorites = useQuickAccessStore((s) => s.favorites)

  const subscribe = useCallback(
    (onChange: () => void) => {
      // Changes made while nothing was subscribed never cleared the snapshot.
      snapshots.delete(qc)
      return qc.getQueryCache().subscribe((event) => {
        // Observer events fire synchronously during another component's render
        // (see services/query-client.ts); only data transitions matter here.
        if (event.type !== 'updated' && event.type !== 'removed') return
        const head = event.query.queryKey[0]
        if (typeof head !== 'string' || !SOURCE_KEYS.has(head)) return
        snapshots.delete(qc)
        onChange()
      })
    },
    [qc],
  )
  const getSnapshot = useCallback(() => {
    let cache = snapshots.get(qc)
    if (!cache) {
      cache = readShelfCache(qc)
      snapshots.set(qc, cache)
    }
    return cache
  }, [qc])
  const cache = useSyncExternalStore(subscribe, getSnapshot)

  return useMemo(() => {
    const entries = buildShelfEntries(favorites, cache)
    return { entries, needsYouCount: countNeedsYou(entries), cache }
  }, [favorites, cache])
}
