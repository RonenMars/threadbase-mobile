import React, { useState, useMemo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import {
  Star, ClockCounterClockwise, Fire,
  CaretUp, CaretDown, GearSix, PencilSimple, Check,
} from 'phosphor-react-native'
import { useQuickAccessStore } from '@/stores/quickAccess'
import { useServersStore } from '@/stores/servers'
import { useRecentSessions, usePopularProjects } from '@/hooks/useQuickAccess'
import { QuickAccessChip, type ChipItem, type QuickAccessTab } from './QuickAccessChip'
import { QuickAccessActionSheet } from './QuickAccessActionSheet'
import { dark, font, spacing } from '@/constants/theme'
import type { MultiSession } from '@/types/api'

const INITIAL_CHIPS = 4
const LOAD_MORE_STEP = 4

export function QuickAccessStrip() {
  const router = useRouter()
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const {
    favorites, ignoredRecents, ignoredPopular,
    stripCollapsed, favoritesEnabled, recentsEnabled, popularEnabled,
    setStripCollapsed, pinItem, unpinItem, ignoreRecent, ignorePopular,
  } = useQuickAccessStore()

  const [currentTab, setCurrentTab] = useState<QuickAccessTab>('favorites')
  const [editMode, setEditMode] = useState(false)
  const [visibleCount, setVisibleCount] = useState(INITIAL_CHIPS)
  const [activeItem, setActiveItem] = useState<ChipItem | null>(null)

  const handleTabSwitch = (tab: QuickAccessTab) => {
    setCurrentTab(tab)
    setEditMode(false)
    setVisibleCount(INITIAL_CHIPS)
  }

  const firstServerId = activeServerIds[0] ?? ''
  const { data: recentsData } = useRecentSessions(firstServerId)
  const { data: popularData } = usePopularProjects(firstServerId)

  const enabledTabs = useMemo((): QuickAccessTab[] => {
    const tabs: QuickAccessTab[] = []
    if (favoritesEnabled) tabs.push('favorites')
    if (recentsEnabled) tabs.push('recents')
    if (popularEnabled) tabs.push('popular')
    return tabs
  }, [favoritesEnabled, recentsEnabled, popularEnabled])

  const effectiveTab: QuickAccessTab = enabledTabs.includes(currentTab)
    ? currentTab
    : (enabledTabs[0] ?? 'favorites')

  const allItems = useMemo((): ChipItem[] => {
    if (effectiveTab === 'favorites') {
      return favorites.map((f) => ({ type: f.type, id: f.id, label: f.label, serverId: f.serverId }))
    }
    if (effectiveTab === 'recents') {
      return (recentsData?.sessions ?? [])
        .filter((s: MultiSession) => !ignoredRecents.includes(`${s.serverId ?? firstServerId}::${s.id}`))
        .map((s: MultiSession) => ({
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

  const isFavorite = (item: ChipItem) => favorites.some((f) => f.id === item.id)

  const handleChipPress = (item: ChipItem) => { if (!editMode) setActiveItem(item) }

  const handleDelete = (item: ChipItem) => {
    if (effectiveTab === 'favorites') unpinItem(item.id)
    else if (effectiveTab === 'recents') ignoreRecent(item.id)
    else ignorePopular(item.id)
  }

  const handleTogglePin = () => {
    if (!activeItem) return
    if (isFavorite(activeItem)) unpinItem(activeItem.id)
    else pinItem({ type: activeItem.type, id: activeItem.id, label: activeItem.label, serverId: activeItem.serverId })
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
    { key: 'favorites', label: 'Favorites', Icon: Star },
    { key: 'recents',   label: 'Recents',   Icon: ClockCounterClockwise },
    { key: 'popular',   label: 'Popular',   Icon: Fire },
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
          {effectiveTab === 'favorites' && (
            <Pressable style={styles.iconBtn} onPress={() => router.push('/manage-favorites')} hitSlop={8}>
              <GearSix size={16} color={dark.text.secondary} />
            </Pressable>
          )}
          <Pressable style={styles.iconBtn} onPress={() => setEditMode((v) => !v)} hitSlop={8}>
            {editMode
              ? <Check size={16} color={dark.text.accent} />
              : <PencilSimple size={16} color={dark.text.secondary} />
            }
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => setStripCollapsed(!stripCollapsed)} hitSlop={8}>
            {stripCollapsed
              ? <CaretDown size={16} color={dark.text.accent} />
              : <CaretUp size={16} color={dark.text.accent} />
            }
          </Pressable>
        </View>
      </View>

      {!stripCollapsed && (
        <View style={styles.chipsContainer}>
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
                <Text style={styles.loadMoreText}>+ {loadMoreCount} more</Text>
              </Pressable>
            )}
          </View>
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
})
