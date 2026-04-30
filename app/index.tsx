import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useDebounce } from 'use-debounce'
import {
  View,
  Text,
  Image,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  AppState,
  FlatList,
  RefreshControl,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useEagerSessions } from '@/hooks/useSession'
import { useEagerConversations, useConversationSearch } from '@/hooks/useConversations'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import { wsManager } from '@/services/ws-client'
import { ProjectHubList } from '@/components/sessions/hub/ProjectHubList'
import { ConversationList } from '@/components/conversation/ConversationList'
import { ClassicSessionsList } from '@/components/sessions/classic/ClassicSessionsList'
import { TreeSessionsList } from '@/components/sessions/tree/TreeSessionsList'
import { SessionCard } from '@/components/sessions/SessionCard'
import { FilterSortSheet } from '@/components/servers/FilterSortSheet'
import { ServerStatusModal } from '@/components/servers/ServerStatusModal'
import { FAB } from '@/components/ui/FAB'
import { NewSessionServerPicker } from '@/components/servers/NewSessionServerPicker'
import { MagnifyingGlass, SlidersHorizontal, Cloud, Lightning, Books, DotsThreeOutline, Gear, EnvelopeSimple, FolderSimple } from 'phosphor-react-native'
import { dark, font, spacing } from '@/constants/theme'
import { searchStyles } from '@/components/sessions/SearchStyles'
import type { MultiSession, MultiConversation, SessionStatus } from '@/types/api'
import type { SortBy, SortOrder } from '@/types/ui'

const ALL_STATUSES: SessionStatus[] = ['running', 'idle']

type ClassicTab = 'sessions' | 'history'

type MergedItem =
  | { kind: 'session'; ms: number; item: MultiSession }
  | { kind: 'conversation'; ms: number; item: MultiConversation }

function lastActivityMs(s: MultiSession): number {
  if (s.completedAt) return Date.parse(s.completedAt)
  return Date.parse(s.startedAt) + (s.elapsedMs ?? 0)
}

export default function ProjectsHub() {
  const router = useRouter()
  const sessionsLayout = useSettingsStore((s) => s.sessionsLayout)
  const mergeChats = useSettingsStore((s) => (s as any).mergeChats ?? false)
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const servers = useServersStore((s) => s.servers)

  // Connection status
  const [connectedCount, setConnectedCount] = useState(0)
  useEffect(() => {
    const updateCount = () => {
      let count = 0
      for (const id of activeServerIds) {
        if (wsManager.status(id) === 'connected') count++
      }
      setConnectedCount(count)
    }
    updateCount()
    const unsub = wsManager.onAnyStatusChange(() => updateCount())
    return unsub
  }, [activeServerIds])

  const serverCount = activeServerIds.length
  const allConnected = connectedCount === serverCount && serverCount > 0
  const someConnected = connectedCount > 0

  // Header controls
  const [searchOpen, setSearchOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pickerVisible, setPickerVisible] = useState(false)

  // Sort state (hub mode)
  const [sortBy, setSortBy] = useState<SortBy>('lastActivity')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Filter state (sessions)
  const [selectedStatuses, setSelectedStatuses] = useState<SessionStatus[]>(ALL_STATUSES)
  const isSheetActive =
    sortBy !== 'lastActivity' ||
    sortOrder !== 'desc' ||
    selectedStatuses.length < ALL_STATUSES.length ||
    (activeServerIds.length > 1 && displayedServerIds.length < activeServerIds.length)

  // Classic tab
  const [classicTab, setClassicTab] = useState<ClassicTab>('sessions')
  const [classicConvSearch, setClassicConvSearch] = useState('')
  const [debouncedConvSearch] = useDebounce(classicConvSearch, 300)
  const { data: convSearchData } = useConversationSearch(debouncedConvSearch)

  useEffect(() => {
    if (!searchOpen) setClassicConvSearch('')
  }, [searchOpen])

  // Sessions data
  const { sessions, isDone: sessionsDone, isCounting, refetch: refetchSessions } = useEagerSessions()
  const [manualRefreshing, setManualRefreshing] = useState(false)

  const handleSessionsRefresh = async () => {
    setManualRefreshing(true)
    await refetchSessions()
    setManualRefreshing(false)
  }

  const visibleSessions = useMemo(() => {
    return sessions.filter(
      (session) =>
        session.source !== 'discovered' &&
        displayedServerIds.includes(session.serverId) &&
        selectedStatuses.includes(session.status),
    ).sort((a, b) => lastActivityMs(b) - lastActivityMs(a))
  }, [sessions, displayedServerIds, selectedStatuses])

  // Conversations data
  const [refreshEpoch, setRefreshEpoch] = useState(0)
  const [convLoaderMode, setConvLoaderMode] = useState<'full' | 'minimal'>('full')
  const nextLoaderModeRef = useRef<'full' | 'minimal'>('minimal')

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        nextLoaderModeRef.current = 'full'
      }
    })
    return () => sub.remove()
  }, [])

  const handleConvRefresh = useCallback(() => {
    setConvLoaderMode('full')
    setRefreshEpoch((e) => e + 1)
  }, [])

  useFocusEffect(
    useCallback(() => {
      refetchSessions()
    }, [refetchSessions]),
  )

  const { conversations, loaded: convLoaded, total: convTotal, isDone: convDone, isCounting: convCounting } =
    useEagerConversations(undefined, refreshEpoch)

  const showConvProgress = !convDone && convLoaderMode === 'full'

  const mergedClassicItems = useMemo((): MergedItem[] => {
    const items: MergedItem[] = [
      ...visibleSessions.map((s) => ({ kind: 'session' as const, ms: lastActivityMs(s), item: s })),
      ...conversations.map((c) => ({ kind: 'conversation' as const, ms: Date.parse(c.lastActivity) || 0, item: c })),
    ]
    return items.sort((a, b) => b.ms - a.ms)
  }, [visibleSessions, conversations])

  // FAB
  const handleFABPress = () => {
    if (activeServerIds.length === 0) return
    if (activeServerIds.length === 1) {
      router.push(`/browse?server=${activeServerIds[0]}`)
      return
    }
    setPickerVisible(true)
  }

  const startSessionOn = (serverId: string) => {
    setPickerVisible(false)
    router.push(`/browse?server=${serverId}`)
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        {/* Left: brand */}
        <View style={styles.headerLeft}>
          <Image source={require('../assets/icon.png')} style={styles.headerIcon} />
          <Text style={styles.headerTitle}>Threadbase</Text>
        </View>

        {/* Right: actions */}
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => setStatusModalOpen(true)}
            hitSlop={8}
            style={styles.headerButton}
            accessibilityLabel="Server status"
          >
            <Cloud size={20} color={dark.text.secondary} />
            {!allConnected ? (
              <View style={[styles.notifDot, { backgroundColor: someConnected ? dark.status.waiting : dark.status.failed }]} />
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSearchOpen((v) => !v)}
            hitSlop={8}
            style={[styles.headerButton, searchOpen && styles.headerButtonActive]}
            accessibilityLabel="Search"
          >
            <MagnifyingGlass size={20} color={searchOpen ? dark.text.primary : dark.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSheetOpen(true)}
            hitSlop={8}
            style={[styles.headerButton, isSheetActive && styles.headerButtonActive]}
            accessibilityLabel="Filter & Sort"
          >
            <SlidersHorizontal size={20} color={isSheetActive ? dark.text.accent : dark.text.secondary} />
            {isSheetActive ? <View style={styles.activeDot} /> : null}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMenuOpen(true)}
            hitSlop={8}
            style={styles.headerButton}
            accessibilityLabel="More options"
          >
            <DotsThreeOutline size={20} color={dark.text.secondary} weight="fill" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {sessionsLayout === 'tree' ? (
        <TreeSessionsList
          sessions={sessions}
          conversations={conversations}
          refreshing={manualRefreshing}
          onRefresh={handleSessionsRefresh}
          searchOpen={searchOpen}
        />
      ) : sessionsLayout === 'hub' ? (
        <ProjectHubList
          sessions={sessions}
          conversations={conversations}
          sortBy={sortBy}
          sortOrder={sortOrder}
          refreshing={manualRefreshing}
          onRefresh={handleSessionsRefresh}
          searchOpen={searchOpen}
        />
      ) : (
        <View style={styles.classicContainer}>
          {mergeChats ? (
            // Merged: single chronological list of sessions + conversations
            <MergedClassicList
              items={mergedClassicItems}
              refreshing={manualRefreshing}
              onRefresh={handleSessionsRefresh}
              searchOpen={searchOpen}
              searchQuery={classicConvSearch}
              onSearchChange={setClassicConvSearch}
            />
          ) : (
            <>
              {/* Segmented control */}
              <View style={styles.segmentRow}>
                <TouchableOpacity
                  style={[styles.segmentTab, classicTab === 'sessions' && styles.segmentTabActive]}
                  onPress={() => setClassicTab('sessions')}
                >
                  <Lightning size={13} color={classicTab === 'sessions' ? dark.text.primary : dark.text.secondary} />
                  <Text style={[styles.segmentText, classicTab === 'sessions' && styles.segmentTextActive]}>
                    Sessions
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentTab, classicTab === 'history' && styles.segmentTabActive]}
                  onPress={() => setClassicTab('history')}
                >
                  <Books size={13} color={classicTab === 'history' ? dark.text.primary : dark.text.secondary} />
                  <Text style={[styles.segmentText, classicTab === 'history' && styles.segmentTextActive]}>
                    History
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Classic sessions */}
              {classicTab === 'sessions' ? (
                <ClassicSessionsList
                  sessions={visibleSessions}
                  refreshing={manualRefreshing}
                  onRefresh={handleSessionsRefresh}
                  searchOpen={searchOpen}
                />
              ) : (
                /* Classic history */
                <ConversationList
                  conversations={debouncedConvSearch ? (convSearchData?.conversations ?? []) : conversations}
                  onRefresh={handleConvRefresh}
                  refreshing={showConvProgress}
                  onEndReached={() => {}}
                  searchQuery={classicConvSearch}
                  onSearchChange={setClassicConvSearch}
                  searchOpen={searchOpen}
                  isLoadingInitial={false}
                  isFetchingNextPage={false}
                  loadingProgress={
                    showConvProgress && !debouncedConvSearch ? { loaded: convLoaded, total: convTotal, isCounting: convCounting } : null
                  }
                />
              )}
            </>
          )}
        </View>
      )}

      {/* FAB */}
      <FAB onPress={handleFABPress} />

      {/* Three-dots menu */}
      {menuOpen ? (
        <HeaderMenu
          onClose={() => setMenuOpen(false)}
          onSettings={() => { setMenuOpen(false); router.push('/settings') }}
        />
      ) : null}

      {/* Modals & Sheets */}
      <ServerStatusModal
        visible={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
      />
      <FilterSortSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onChangeSortBy={setSortBy}
        onChangeSortOrder={setSortOrder}
        selectedStatuses={selectedStatuses}
        onChangeStatuses={setSelectedStatuses}
      />
      <NewSessionServerPicker
        visible={pickerVisible}
        serverIds={activeServerIds}
        servers={servers}
        onPick={startSessionOn}
        onClose={() => setPickerVisible(false)}
      />
    </SafeAreaView>
  )
}

function MergedClassicList({
  items,
  refreshing,
  onRefresh,
  searchOpen,
  searchQuery,
  onSearchChange,
}: {
  items: MergedItem[]
  refreshing: boolean
  onRefresh: () => void
  searchOpen: boolean
  searchQuery: string
  onSearchChange: (q: string) => void
}) {
  const router = useRouter()
  const filteredItems = useMemo(() => {
    if (!searchQuery) return items
    const q = searchQuery.toLowerCase()
    return items.filter((item) => {
      if (item.kind === 'session') {
        const s = item.item as MultiSession
        return s.projectName?.toLowerCase().includes(q) || s.lastOutput?.toLowerCase().includes(q)
      }
      const c = item.item as MultiConversation
      return (
        c.title?.toLowerCase().includes(q) ||
        c.preview?.toLowerCase().includes(q)
      )
    })
  }, [searchQuery, items])

  return (
    <View style={{ flex: 1 }}>
      {searchOpen ? (
        <View style={searchStyles.searchBar}>
          <TextInput
            style={searchStyles.searchInput}
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder="Search sessions & conversations…"
            placeholderTextColor={dark.text.secondary}
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      ) : null}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) =>
          item.kind === 'session'
            ? `s-${item.item.serverId}::${item.item.id}`
            : `c-${item.item.serverId}::${item.item.id}`
        }
        renderItem={({ item }) =>
          item.kind === 'session' ? (
            <SessionCard session={item.item as MultiSession} />
          ) : (
            <TouchableOpacity
              style={styles.convCard}
              activeOpacity={0.75}
              onPress={() =>
                router.push(`/conversation/${item.item.id}?server=${item.item.serverId}`)
              }
            >
              <View style={styles.convCardTitleRow}>
                <FolderSimple size={18} color={dark.text.secondary} weight="fill" />
                <Text style={styles.convCardTitle} numberOfLines={1}>
                  {(item.item as MultiConversation).title || item.item.projectPath}
                </Text>
              </View>
              {(item.item as MultiConversation).preview ? (
                <Text style={styles.convCardPreview} numberOfLines={2}>
                  {(item.item as MultiConversation).preview}
                </Text>
              ) : null}
              <Text style={styles.convCardMeta}>
                {(item.item as MultiConversation).messageCount} msg{(item.item as MultiConversation).messageCount !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          )
        }
        contentContainerStyle={styles.mergedContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={dark.text.secondary} />
        }
      />
    </View>
  )
}

function HeaderMenu({
  onClose,
  onSettings,
}: {
  onClose: () => void
  onSettings: () => void
}) {
  const handleSupport = () => {
    Linking.openURL('mailto:ronenmars@gmail.com?subject=Threadbase%20Support')
    onClose()
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={menuStyles.backdrop} onPress={onClose}>
        <Pressable style={menuStyles.menu} onPress={() => {}}>
          <TouchableOpacity style={menuStyles.item} onPress={onSettings}>
            <Gear size={18} color={dark.text.secondary} />
            <Text style={menuStyles.itemText}>Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[menuStyles.item, menuStyles.itemLast]} onPress={handleSupport}>
            <EnvelopeSimple size={18} color={dark.text.secondary} />
            <Text style={menuStyles.itemText}>Help & Support</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const menuStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  menu: {
    position: 'absolute',
    top: 56,
    right: spacing.md,
    backgroundColor: dark.bg.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: dark.border,
    minWidth: 180,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.border,
    minHeight: 44,
  },
  itemLast: { borderBottomWidth: 0 },
  itemText: { color: dark.text.primary, fontSize: font.base },
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark.bg.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerIcon: {
    width: 22,
    height: 22,
    borderRadius: 5,
  },
  headerTitle: {
    color: dark.text.primary,
    fontSize: font.lg,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  notifDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: dark.bg.primary,
  },
  headerButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  headerButtonActive: {
    backgroundColor: 'rgba(88,166,255,0.12)',
  },
  activeDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: dark.text.accent,
  },
  classicContainer: {
    flex: 1,
  },
  segmentRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: dark.bg.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: dark.border,
    overflow: 'hidden',
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 36,
  },
  segmentTabActive: {
    backgroundColor: dark.bg.secondary,
  },
  segmentText: {
    color: dark.text.secondary,
    fontSize: font.sm,
    fontWeight: '500',
  },
  segmentTextActive: {
    color: dark.text.primary,
    fontWeight: '600',
  },
  mergedContent: {
    padding: spacing.sm,
    flexGrow: 1,
  },
  convCard: {
    backgroundColor: dark.bg.card,
    borderRadius: 10,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: dark.border,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  convCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  convCardTitle: {
    flex: 1,
    color: dark.text.primary,
    fontSize: font.base,
    fontWeight: '600',
  },
  convCardPreview: {
    color: dark.text.secondary,
    fontSize: font.xs,
  },
  convCardMeta: {
    color: dark.text.secondary,
    fontSize: font.xs,
  },
})
