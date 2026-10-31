import { useEffect, useMemo, useRef } from 'react'
import { AppState } from 'react-native'
import i18n from '@/lib/i18n'
import { createSavedItemsSync, type SavedItemsSync } from '@/lib/savedItemsSync'
import {
  deleteSavedItem,
  listSavedItems,
  putSavedItem,
  reorderSavedItems,
  serverSupportsSavedItems,
} from '@/services/saved-items'
import { wsManager } from '@/services/ws-client'
import { useAlertStore } from '@/stores/alerts'
import { useQuickAccessStore } from '@/stores/quickAccess'
import { useServersStore } from '@/stores/servers'
import { savedItemsCause } from '@/types/alerts'

function isSyncable(serverId: string): boolean {
  const server = useServersStore.getState().servers[serverId]
  return !!server?.isConnected && serverSupportsSavedItems(serverId)
}

function connectedSyncableIds(): string[] {
  const { activeServerIds } = useServersStore.getState()
  return activeServerIds.filter(isSyncable)
}

export function createAppSavedItemsSync(): SavedItemsSync {
  return createSavedItemsSync({
    list: listSavedItems,
    put: putSavedItem,
    remove: deleteSavedItem,
    reorder: reorderSavedItems,
    supports: serverSupportsSavedItems,
    getFavorites: () => useQuickAccessStore.getState().favorites,
    setFavorites: (favorites) => useQuickAccessStore.getState().setFavorites(favorites),
    isBootstrapped: (serverId) => useQuickAccessStore.getState().savedItemsBootstrapped.includes(serverId),
    markBootstrapped: (serverId) => useQuickAccessStore.getState().markSavedItemsBootstrapped(serverId),
    onWriteFailed: (serverId) => {
      useAlertStore.getState().upsert({
        id: `saved-items-sync:${serverId}`,
        cause: savedItemsCause(serverId),
        level: 'warning',
        title: i18n.t('shared:savedItems.syncFailedTitle'),
        message: i18n.t('shared:savedItems.syncFailedMessage'),
        testID: 'saved-items-sync-failed',
      })
    },
  })
}

/**
 * Keep favorites in step with every paired server that reports `savedItems`.
 *
 * Starts only after the quickAccess store has hydrated: a pull before that
 * would compare the server against an empty list, and the hydrate that
 * followed would then read as a local edit and overwrite the server.
 */
export function useSavedItemsSync(): void {
  const sync = useMemo(() => createAppSavedItemsSync(), [])
  const hydrated = useQuickAccessStore((s) => s.hydrated)
  const syncableKey = useServersStore((s) =>
    s.activeServerIds
      .filter((id) => !!s.servers[id]?.isConnected && s.servers[id]?.serverInfo?.savedItems === true)
      .join('|'),
  )
  const pulled = useRef(new Set<string>())

  useEffect(() => {
    if (!hydrated) return
    return useQuickAccessStore.subscribe((state, prev) => {
      if (state.favorites !== prev.favorites) sync.onLocalChange()
    })
  }, [hydrated, sync])

  // A server that just became reachable and capable gets one pull; one that
  // dropped out is pulled again when it comes back.
  useEffect(() => {
    if (!hydrated) return
    const now = new Set(syncableKey ? syncableKey.split('|') : [])
    for (const id of now) {
      if (!pulled.current.has(id)) void sync.pull(id)
    }
    pulled.current = now
  }, [hydrated, syncableKey, sync])

  // Subscribed per connected set: `onAll` binds only to clients that exist now.
  useEffect(() => {
    if (!hydrated || !syncableKey) return
    return wsManager.onAll('saved_items_changed', (msg) => {
      if (msg.type !== 'saved_items_changed' || typeof msg.revision !== 'number') return
      sync.onRemoteRevision(msg.serverId, msg.revision)
    })
  }, [hydrated, syncableKey, sync])

  useEffect(() => {
    if (!hydrated) return
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      for (const id of connectedSyncableIds()) void sync.pull(id)
    })
    return () => subscription.remove()
  }, [hydrated, sync])
}
