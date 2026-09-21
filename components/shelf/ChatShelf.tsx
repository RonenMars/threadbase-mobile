import React, { useCallback, useMemo, useState } from 'react'
import { AccessibilityInfo, StyleSheet } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import { useGlobalSearchParams, useRouter, useSegments } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useReduceMotion } from '@/hooks/useAccessibilitySettings'
import { useSavedShelf } from '@/hooks/useSavedShelf'
import { labelFromCache, openSavedItem, type ShelfEntry, type ShelfTarget } from '@/lib/savedShelf'
import { useAppDirection } from '@/lib/rtl'
import { buildFavoriteId, useQuickAccessStore } from '@/stores/quickAccess'
import { useServersStore } from '@/stores/servers'
import { useSessionNamesStore } from '@/stores/sessionNames'
import { ShelfBubble } from './ShelfBubble'
import { ShelfPanel } from './ShelfPanel'

// First route segments where the shelf has nothing to offer. The biometric
// lock needs no entry: BiometricLockGate renders its lock screen instead of
// its children, so the shelf is not mounted while locked.
const HIDDEN_SEGMENTS: ReadonlySet<string> = new Set(['onboarding', 'pair'])

function currentScreenTarget(segments: string[], id?: string, server?: string): ShelfTarget | null {
  if (!id || !server) return null
  const [root, leaf] = segments
  if (root === 'session' && leaf === '[id]') return { kind: 'session', serverId: server, id }
  if (root === 'conversation' && leaf === '[id]') return { kind: 'conversation', serverId: server, id }
  return null
}

/** Floating quick-access shelf for saved sessions and conversations, mounted once at the root. */
export function ChatShelf() {
  const { t } = useTranslation('shared')
  const router = useRouter()
  const segments = useSegments()
  const { id, server } = useGlobalSearchParams<{ id?: string; server?: string }>()
  const { isRTL } = useAppDirection()
  const reduceMotion = useReduceMotion()
  const favoritesEnabled = useQuickAccessStore((s) => s.favoritesEnabled)
  const favorites = useQuickAccessStore((s) => s.favorites)
  const shelfPosition = useQuickAccessStore((s) => s.shelfPosition)
  const setShelfPosition = useQuickAccessStore((s) => s.setShelfPosition)
  const servers = useServersStore((s) => s.servers)
  const { entries, needsYouCount, cache } = useSavedShelf()
  const [panelOpen, setPanelOpen] = useState(false)

  const { progress } = useReanimatedKeyboardAnimation()
  const keyboardStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    pointerEvents: progress.value > 0 ? 'none' : 'box-none',
  }))

  const serverLabels = useMemo(() => {
    const ids = Object.keys(servers)
    if (ids.length < 2) return null
    return Object.fromEntries(ids.map((sid) => [sid, servers[sid].label ?? sid]))
  }, [servers])

  const target = currentScreenTarget(segments, id, server)

  const openPanel = useCallback(() => setPanelOpen(true), [])
  const closePanel = useCallback(() => setPanelOpen(false), [])

  const toggleSave = useCallback(() => {
    if (!target) return
    const favoriteId = buildFavoriteId(target.serverId, target.kind, target.id)
    const { favorites: current, pinItem, unpinItem } = useQuickAccessStore.getState()
    if (current.some((f) => f.id === favoriteId)) {
      unpinItem(favoriteId)
      AccessibilityInfo.announceForAccessibility(t('shelf.removed'))
      return
    }
    const cachedLabel = target.kind === 'session'
      ? useSessionNamesStore.getState().getName(target.serverId, target.id) ?? labelFromCache(target, cache)
      : labelFromCache(target, cache)
    const label = cachedLabel || target.id
    if (target.kind === 'session') {
      pinItem({ type: 'session', id: favoriteId, label, serverId: target.serverId, sessionId: target.id })
    } else {
      pinItem({ type: 'conversation', id: favoriteId, label, serverId: target.serverId, conversationId: target.id })
    }
    AccessibilityInfo.announceForAccessibility(t('shelf.saved'))
  }, [target, cache, t])

  const selectEntry = useCallback(
    (entry: ShelfEntry) => {
      setPanelOpen(false)
      openSavedItem(entry.target, router)
    },
    [router],
  )

  if (!favoritesEnabled || favorites.length === 0 || HIDDEN_SEGMENTS.has(segments[0] ?? '')) return null

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, keyboardStyle]} pointerEvents="box-none">
        <ShelfBubble
          position={shelfPosition}
          isRTL={isRTL}
          reduceMotion={reduceMotion}
          needsYouCount={needsYouCount}
          onOpen={openPanel}
          onToggleSave={toggleSave}
          onSnap={setShelfPosition}
        />
      </Animated.View>
      <ShelfPanel
        visible={panelOpen}
        entries={entries}
        serverLabels={serverLabels}
        reduceMotion={reduceMotion}
        onSelect={selectEntry}
        onClose={closePanel}
      />
    </>
  )
}
