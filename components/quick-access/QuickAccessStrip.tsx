import React, { useState, useMemo, useRef, useEffect } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import {
  Star,
  GearSix, PencilSimple, Check,
} from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useQuickAccessStore } from '@/stores/quickAccess'
import { useServersStore } from '@/stores/servers'
import { useNavLockStore } from '@/stores/navLock'
import { QuickAccessChip, type ChipItem, type QuickAccessTab } from './QuickAccessChip'
import { QuickAccessActionSheet } from './QuickAccessActionSheet'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { clientLog } from '@/lib/clientLog'

const INITIAL_CHIPS = 4
const LOAD_MORE_STEP = 4

export function QuickAccessStrip() {
  const { t } = useTranslation('shared')
  const router = useRouter()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const {
    favorites,
    stripCollapsed, favoritesEnabled,
    setStripCollapsed, pinItem, unpinItem,
  } = useQuickAccessStore()

  const [editMode, setEditMode] = useState(false)
  const [visibleCount, setVisibleCount] = useState(INITIAL_CHIPS)
  const [activeItem, setActiveItem] = useState<ChipItem | null>(null)

  const queriedServerIds = useMemo(
    () => (displayedServerIds.length > 0 ? displayedServerIds : activeServerIds),
    [displayedServerIds, activeServerIds],
  )
  const firstServerId = queriedServerIds[0] ?? ''

  const mounted = useRef(false)
  useEffect(() => {
    if (mounted.current) return
    mounted.current = true
    clientLog.info('strip.mount', 'QuickAccessStrip mounted', {
      queriedServerIds,
      favoritesEnabled,
      stripCollapsed,
      favoritesCount: favorites.length,
    })
    // Mount-only diagnostic log — captures initial snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTabSwitch = () => {
    if (stripCollapsed) {
      setStripCollapsed(false)
    } else {
      setEditMode(false)
      setStripCollapsed(true)
    }
    setVisibleCount(INITIAL_CHIPS)
  }

  if (!favoritesEnabled || favorites.length === 0) return null

  const allItems: ChipItem[] = favorites.map((f) => ({
    type: f.type,
    id: f.id,
    label: f.label,
    serverId: f.serverId,
    conversationId: f.type === 'conversation' ? f.conversationId : undefined,
  }))

  const visibleItems = allItems.slice(0, visibleCount)
  const remaining = allItems.length - visibleCount
  const loadMoreCount = Math.min(LOAD_MORE_STEP, remaining)

  const isFavorite = (item: ChipItem) => favorites.some((f) => f.id === item.id)

  const handleChipPress = (item: ChipItem) => { if (!editMode) setActiveItem(item) }

  const handleDelete = (item: ChipItem) => unpinItem(item.id)

  const handleTogglePin = () => {
    if (!activeItem) return
    if (isFavorite(activeItem)) {
      unpinItem(activeItem.id)
    } else {
      if (activeItem.type === 'dir') {
        pinItem({ type: 'dir', id: activeItem.id, label: activeItem.label, serverId: activeItem.serverId })
      } else if (activeItem.type === 'session' && activeItem.serverId) {
        const [, sessionId] = activeItem.id.split('::')
        pinItem({ type: 'session', id: activeItem.id, label: activeItem.label, serverId: activeItem.serverId, sessionId })
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
    useNavLockStore.getState().lock()
    if (activeItem.type === 'conversation') {
      router.push(`/conversation/${activeItem.conversationId}?server=${activeItem.serverId}`)
    } else {
      const [, id] = activeItem.id.split('::')
      router.push(`/session/${id}?server=${activeItem.serverId}`)
    }
    setActiveItem(null)
  }

  return (
    <View style={styles.strip}>
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, !stripCollapsed && styles.tabActive]}
          onPress={handleTabSwitch}
        >
          <Star size={13} color={!stripCollapsed ? theme.text.accent : theme.text.secondary} />
          <Text style={[styles.tabLabel, !stripCollapsed && styles.tabLabelActive]}>
            {t('quickAccess.tabs.favorites', 'Favorites')}
          </Text>
        </Pressable>

        <View style={styles.tabRight}>
          {!stripCollapsed && (
            <Pressable style={styles.iconBtn} onPress={() => router.push('/manage-favorites' as any)} hitSlop={8}>
              <GearSix size={16} color={theme.text.secondary} />
            </Pressable>
          )}
          {!stripCollapsed && allItems.length > 0 && (
            <Pressable style={styles.iconBtn} onPress={() => setEditMode((v) => !v)} hitSlop={8}>
              {editMode
                ? <Check size={16} color={theme.text.accent} />
                : <PencilSimple size={16} color={theme.text.secondary} />
              }
            </Pressable>
          )}
        </View>
      </View>

      {!stripCollapsed && (
        <View style={styles.chipsContainer}>
          {visibleItems.length === 0 ? (
            <Text style={styles.emptyText}>{t('quickAccess.emptyFavorites')}</Text>
          ) : (
            <View style={styles.chips}>
              {visibleItems.map((item) => (
                <QuickAccessChip
                  key={item.id}
                  item={item}
                  tab={'favorites' as QuickAccessTab}
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
          )}
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

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    strip: {
      backgroundColor: theme.bg.secondary,
      borderBottomWidth: 1,
      borderColor: theme.border,
    },
    tabBar: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderColor: theme.border,
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
    tabActive: { borderColor: theme.text.accent },
    tabLabel: { color: theme.text.secondary, fontSize: font.base },
    tabLabelActive: { color: theme.text.accent, fontWeight: '600' },
    tabRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', paddingRight: spacing.sm },
    iconBtn: { padding: 6 },
    chipsContainer: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    loadMoreChip: {
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    loadMoreText: { color: theme.text.secondary, fontSize: font.xs },
    emptyText: { color: theme.text.secondary, fontSize: font.xs, paddingVertical: 2 },
  })
}
