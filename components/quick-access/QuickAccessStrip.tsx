import React, { useState, useMemo, useEffect, useRef } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import {
  Star, ClockCounterClockwise, Fire,
  CaretUp, CaretDown, GearSix, PencilSimple, Check,
} from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useQuickAccessStore } from '@/stores/quickAccess'
import { useServersStore } from '@/stores/servers'
import { useRecentSessions, usePopularProjects } from '@/hooks/useQuickAccess'
import { QuickAccessChip, type ChipItem, type QuickAccessTab } from './QuickAccessChip'
import { QuickAccessActionSheet } from './QuickAccessActionSheet'
import { dark, font, spacing } from '@/constants/theme'
import { clientLog } from '@/lib/clientLog'

const INITIAL_CHIPS = 4
const LOAD_MORE_STEP = 4

export function QuickAccessStrip() {
  const { t } = useTranslation('shared')
  const router = useRouter()
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const {
    favorites, ignoredRecents, ignoredPopular,
    stripCollapsed, favoritesEnabled, recentsEnabled, popularEnabled,
    setStripCollapsed, pinItem, unpinItem, ignoreRecent, ignorePopular,
  } = useQuickAccessStore()

  const [currentTab, setCurrentTab] = useState<QuickAccessTab>('recents')
  const [editMode, setEditMode] = useState(false)
  const [visibleCount, setVisibleCount] = useState(INITIAL_CHIPS)
  const [activeItem, setActiveItem] = useState<ChipItem | null>(null)

  const handleTabSwitch = (tab: QuickAccessTab) => {
    setCurrentTab(tab)
    setEditMode(false)
    setVisibleCount(INITIAL_CHIPS)
  }

  // Fan out across user-displayed servers (or fall back to all active servers
  // when the user hasn't trimmed the list — keeps single-server users working
  // out of the box).
  const queriedServerIds = useMemo(
    () => (displayedServerIds.length > 0 ? displayedServerIds : activeServerIds),
    [displayedServerIds, activeServerIds],
  )
  const firstServerId = queriedServerIds[0] ?? ''
  const recentsQuery = useRecentSessions(queriedServerIds)
  const popularQuery = usePopularProjects(queriedServerIds)
  const recentsData = recentsQuery.data
  const popularData = popularQuery.data

  // Mount once
  const mounted = useRef(false)
  useEffect(() => {
    if (mounted.current) return
    mounted.current = true
    clientLog.info('strip.mount', 'QuickAccessStrip mounted', {
      queriedServerIds,
      queriedServerIdsCount: queriedServerIds.length,
      activeServerIdsCount: activeServerIds.length,
      displayedServerIdsCount: displayedServerIds.length,
      favoritesEnabled,
      recentsEnabled,
      popularEnabled,
      stripCollapsed,
      favoritesCount: favorites.length,
    })
    // Mount-only diagnostic log — captures initial snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Track every render's key state
  useEffect(() => {
    clientLog.info('strip.render', 'state snapshot', {
      queriedServerIdsLen: queriedServerIds.length,
      activeServerIdsLen: activeServerIds.length,
      displayedServerIdsLen: displayedServerIds.length,
      recentsStatus: recentsQuery.status,
      recentsFetchStatus: recentsQuery.fetchStatus,
      recentsPerServerErrors: recentsQuery.perServerErrors,
      recentsError: recentsQuery.error ? String(recentsQuery.error) : null,
      recentsSessions: recentsData?.sessions?.length ?? null,
      popularStatus: popularQuery.status,
      popularFetchStatus: popularQuery.fetchStatus,
      popularPerServerErrors: popularQuery.perServerErrors,
      popularError: popularQuery.error ? String(popularQuery.error) : null,
      popularProjects: popularData?.projects?.length ?? null,
      favoritesEnabled,
      recentsEnabled,
      popularEnabled,
      stripCollapsed,
      currentTab,
    })
  }, [
    queriedServerIds.length,
    activeServerIds.length,
    displayedServerIds.length,
    recentsQuery.status,
    recentsQuery.fetchStatus,
    recentsQuery.perServerErrors,
    recentsQuery.error,
    recentsData?.sessions?.length,
    popularQuery.status,
    popularQuery.fetchStatus,
    popularQuery.perServerErrors,
    popularQuery.error,
    popularData?.projects?.length,
    favoritesEnabled,
    recentsEnabled,
    popularEnabled,
    stripCollapsed,
    currentTab,
  ])

  const enabledTabs = useMemo((): QuickAccessTab[] => {
    const tabs: QuickAccessTab[] = []
    if (recentsEnabled) tabs.push('recents')
    if (popularEnabled) tabs.push('popular')
    if (favoritesEnabled) tabs.push('favorites')
    return tabs
  }, [favoritesEnabled, recentsEnabled, popularEnabled])

  const effectiveTab: QuickAccessTab = enabledTabs.includes(currentTab)
    ? currentTab
    : (enabledTabs[0] ?? 'recents')

  const allItems = useMemo((): ChipItem[] => {
    if (effectiveTab === 'favorites') {
      return favorites.map((f) => ({ type: f.type, id: f.id, label: f.label, serverId: f.serverId }))
    }
    if (effectiveTab === 'recents') {
      return (recentsData?.sessions ?? [])
        .filter((s) => !ignoredRecents.includes(`${s.serverId ?? firstServerId}::${s.id}`))
        .map((s) => ({
          type: 'session' as const,
          id: `${s.serverId ?? firstServerId}::${s.id}`,
          label: s.projectName ?? s.projectPath ?? s.id,
          serverId: s.serverId ?? firstServerId,
        }))
    }
    return (popularData?.projects ?? [])
      .filter((p) => !ignoredPopular.includes(p.path))
      .map((p) => ({
        type: 'dir' as const,
        id: p.path,
        label: p.path,
        sessionCount: p.sessionCount,
      }))
  }, [effectiveTab, favorites, recentsData, popularData, ignoredRecents, ignoredPopular, firstServerId])

  const visibleItems = allItems.slice(0, visibleCount)
  const remaining = allItems.length - visibleCount
  const loadMoreCount = Math.min(LOAD_MORE_STEP, remaining)

  if (enabledTabs.length === 0) return null

  // Bug 7b — hide the entire strip when there's nothing to show. We reuse the
  // recents + popular queries already in flight (no extra network call) as a
  // proxy for "any queried server has conversations": popular returns one entry
  // per project with conversations, recents returns recent sessions. Both
  // returning zero from a *settled* (success) query means the user has nothing
  // to surface here. During the initial loading window the queries are still
  // 'pending', so we leave the strip visible to avoid a reflow once data lands.
  const recentsSettledEmpty =
    recentsQuery.status === 'success' && (recentsData?.sessions?.length ?? 0) === 0
  const popularSettledEmpty =
    popularQuery.status === 'success' && (popularData?.projects?.length ?? 0) === 0
  const nothingToShow =
    favorites.length === 0 && recentsSettledEmpty && popularSettledEmpty
  if (nothingToShow) return null

  const isFavorite = (item: ChipItem) => favorites.some((f) => f.id === item.id)

  const handleChipPress = (item: ChipItem) => { if (!editMode) setActiveItem(item) }

  const handleDelete = (item: ChipItem) => {
    if (effectiveTab === 'favorites') unpinItem(item.id)
    else if (effectiveTab === 'recents') ignoreRecent(item.id)
    else ignorePopular(item.id)
  }

  const handleTogglePin = () => {
    if (!activeItem) return
    if (isFavorite(activeItem)) {
      unpinItem(activeItem.id)
    } else {
      // Build a typed favorite. Existing chip data only carries `dir` and
      // `session` shapes today; project-chat favorites are added by the
      // ProjectChat list (Step 5/Step 6) once that flow is wired in.
      if (activeItem.type === 'dir') {
        pinItem({ type: 'dir', id: activeItem.id, label: activeItem.label, serverId: activeItem.serverId })
      } else if (activeItem.type === 'session' && activeItem.serverId) {
        const [, sessionId] = activeItem.id.split('::')
        pinItem({
          type: 'session',
          id: activeItem.id,
          label: activeItem.label,
          serverId: activeItem.serverId,
          sessionId,
        })
      }
    }
    setActiveItem(null)
  }

  const handleNewSession = () => {
    if (!activeItem) return
    const serverId = activeItem.serverId ?? firstServerId
    router.push(`/browse?server=${serverId}&path=${encodeURIComponent(activeItem.id)}`)
    setActiveItem(null)
  }

  const handleBrowse = () => {
    if (!activeItem) return
    const serverId = activeItem.serverId ?? firstServerId
    router.push(`/browse?server=${serverId}&path=${encodeURIComponent(activeItem.id)}`)
    setActiveItem(null)
  }

  const handleOpenSession = () => {
    if (!activeItem?.serverId) return
    const [, sessionId] = activeItem.id.split('::')
    router.push(`/session/${sessionId}?server=${activeItem.serverId}`)
    setActiveItem(null)
  }

  const TAB_DEFS: { key: QuickAccessTab; label: string; Icon: React.ComponentType<any> }[] = [
    { key: 'recents',   label: 'Recents',   Icon: ClockCounterClockwise },
    { key: 'popular',   label: 'Popular',   Icon: Fire },
    { key: 'favorites', label: 'Favorites', Icon: Star },
  ]

  return (
    <View style={styles.strip}>
      <View style={styles.tabBar}>
        {TAB_DEFS.filter((t) => enabledTabs.includes(t.key)).map(({ key, label, Icon }) => (
          <Pressable
            key={key}
            style={[styles.tab, effectiveTab === key && styles.tabActive]}
            onPress={() => handleTabSwitch(key)}
          >
            <Icon size={13} color={effectiveTab === key ? dark.text.accent : dark.text.secondary} />
            <Text style={[styles.tabLabel, effectiveTab === key && styles.tabLabelActive]}>{label}</Text>
          </Pressable>
        ))}

        <View style={styles.tabRight}>
          {/* Bug 9 — hide gear + pencil when collapsed. Neither is actionable
              on a row that just shows tab labels. */}
          {!stripCollapsed && effectiveTab === 'favorites' && (
            <Pressable style={styles.iconBtn} onPress={() => router.push('/manage-favorites' as any)} hitSlop={8}>
              <GearSix size={16} color={dark.text.secondary} />
            </Pressable>
          )}
          {/* Bug 26 — also hide the pencil when the active tab is empty:
              editing an empty set is meaningless. */}
          {!stripCollapsed && allItems.length > 0 && (
            <Pressable style={styles.iconBtn} onPress={() => setEditMode((v) => !v)} hitSlop={8}>
              {editMode
                ? <Check size={16} color={dark.text.accent} />
                : <PencilSimple size={16} color={dark.text.secondary} />
              }
            </Pressable>
          )}
          <Pressable
            style={styles.iconBtn}
            onPress={() => {
              const next = !stripCollapsed
              // Bug 9 — reset edit mode when collapsing so the strip doesn't
              // come back expanded into a half-active edit state.
              if (next) setEditMode(false)
              setStripCollapsed(next)
            }}
            hitSlop={8}
          >
            {stripCollapsed
              ? <CaretDown size={16} color={dark.text.accent} />
              : <CaretUp size={16} color={dark.text.accent} />
            }
          </Pressable>
        </View>
      </View>

      {!stripCollapsed && (
        <View style={styles.chipsContainer}>
          {visibleItems.length === 0
            ? renderEmptyState({
                t,
                tab: effectiveTab,
                hasServers: queriedServerIds.length > 0,
                recentsQuery,
                popularQuery,
                onOpenSettings: () => router.push('/settings' as any),
              })
            : (
              <View style={styles.chips}>
                {visibleItems.map((item) => (
                  <QuickAccessChip
                    key={item.id}
                    item={item}
                    tab={effectiveTab}
                    editMode={editMode}
                    onPress={() => handleChipPress(item)}
                    onDelete={() => handleDelete(item)}
                  />
                ))}
                {remaining > 0 && (
                  <Pressable style={styles.loadMoreChip} onPress={() => setVisibleCount((v) => v + LOAD_MORE_STEP)}>
                    <Text style={styles.loadMoreText}>{t('quickAccess.loadMore', { count: loadMoreCount })}</Text>
                  </Pressable>
                )}
              </View>
            )
          }
        </View>
      )}

      <QuickAccessActionSheet
        item={activeItem}
        isFavorite={activeItem ? isFavorite(activeItem) : false}
        onClose={() => setActiveItem(null)}
        onNewSession={handleNewSession}
        onBrowse={handleBrowse}
        onOpenSession={handleOpenSession}
        onTogglePin={handleTogglePin}
      />
    </View>
  )
}

type QueryShape = {
  status: 'pending' | 'success' | 'error'
  fetchStatus: 'fetching' | 'idle'
  refetch: () => void
  perServerErrors: number
}

function renderEmptyState({
  t, tab, hasServers, recentsQuery, popularQuery, onOpenSettings,
}: {
  t: TFunction<'shared'>
  tab: QuickAccessTab
  hasServers: boolean
  recentsQuery: QueryShape
  popularQuery: QueryShape
  onOpenSettings: () => void
}) {
  if (tab === 'favorites') {
    return <Text style={styles.emptyText}>{t('quickAccess.emptyFavorites')}</Text>
  }

  const q = tab === 'recents' ? recentsQuery : popularQuery

  if (!hasServers) {
    return (
      <Pressable onPress={onOpenSettings} hitSlop={8}>
        <Text style={styles.emptyTextLink}>{t('quickAccess.pairServer', { tab })}</Text>
      </Pressable>
    )
  }
  if (q.status === 'pending' && q.fetchStatus === 'fetching') {
    return <Text style={styles.emptyText}>{t('quickAccess.loading')}</Text>
  }
  if (q.status === 'error') {
    return (
      <Pressable onPress={q.refetch} hitSlop={8}>
        <Text style={styles.emptyTextLink}>{t('quickAccess.loadFailed')}</Text>
      </Pressable>
    )
  }
  return <Text style={styles.emptyText}>{t('quickAccess.nothing')}</Text>
}

const styles = StyleSheet.create({
  strip: {
    backgroundColor: dark.bg.secondary,
    borderBottomWidth: 1,
    borderColor: dark.border,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: dark.border,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderColor: 'transparent',
  },
  tabActive: { borderColor: dark.text.accent },
  tabLabel: { color: dark.text.secondary, fontSize: font.xs },
  tabLabelActive: { color: dark.text.accent, fontWeight: '600' },
  tabRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', paddingRight: spacing.sm },
  iconBtn: { padding: 6 },
  chipsContainer: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  loadMoreChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: dark.border,
  },
  loadMoreText: { color: dark.text.secondary, fontSize: font.xs },
  emptyText: { color: dark.text.secondary, fontSize: font.xs, paddingVertical: 2 },
  emptyTextLink: { color: dark.text.accent, fontSize: font.xs, paddingVertical: 2 },
})
