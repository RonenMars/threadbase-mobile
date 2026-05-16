import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDebounce } from 'use-debounce'
import {
  View,
  Text,
  Image,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  AppState,
  FlatList,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { useEagerSessions } from '@/hooks/useSession'
import { useEagerConversations, useConversationSearch } from '@/hooks/useConversations'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import { useFetchSessionNames } from '@/hooks/useSessionName'
import { wsManager } from '@/services/ws-client'
import { ProjectHubList } from '@/components/sessions/hub/ProjectHubList'
import { ConversationList } from '@/components/conversation/ConversationList'
import { ClassicSessionsList } from '@/components/sessions/classic/ClassicSessionsList'
import { TreeSessionsList } from '@/components/sessions/tree/TreeSessionsList'
import { SessionCard } from '@/components/sessions/SessionCard'
import { LiveSessionsHeader } from '@/components/sessions/LiveSessionsHeader'
import { ServerHeaderRow } from '@/components/sessions/tree/ServerHeaderRow'
import { FilterSortSheet } from '@/components/servers/FilterSortSheet'
import { ServerStatusModal } from '@/components/servers/ServerStatusModal'
import { FAB } from '@/components/ui/FAB'
import { NewSessionServerPicker } from '@/components/servers/NewSessionServerPicker'
import { MagnifyingGlass, SlidersHorizontal, Cloud, Lightning, Books, Gear, FolderSimple } from 'phosphor-react-native'
import { QuickAccessStrip } from '@/components/quick-access/QuickAccessStrip'
import { clientLog } from '@/lib/clientLog'
import { SessionsLoadingOverlay } from '@/components/sessions/SessionsLoadingOverlay'
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

function SessionNamesSyncer({ serverId }: { serverId: string }) {
  useFetchSessionNames(serverId)
  return null
}

export default function ProjectsHub() {
  const { t } = useTranslation(['sessions', 'shared', 'settings'])
  const router = useRouter()
  const sessionsLayout = useSettingsStore((s) => s.sessionsLayout)
  const mergeChats = useSettingsStore((s) => (s as any).mergeChats ?? false)
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const servers = useServersStore((s) => s.servers)

  useEffect(() => {
    clientLog.info('hub.mount', 'ProjectsHub mounted', {
      activeServerIdsLen: activeServerIds.length,
      displayedServerIdsLen: displayedServerIds.length,
      activeIds: activeServerIds,
      displayedIds: displayedServerIds,
      sessionsLayout,
    })
  }, [])

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

  // Sessions data — sort + status filter are now server-side. Per-server
  // selection (displayedServerIds) remains client-side because it's a UI
  // toggle the user can flip without re-querying.
  const {
    sessions,
    isDone: sessionsDone,
    loaded: sessionsLoaded,
    total: sessionsTotal,
    currentServerLabel,
    refetch: refetchSessions,
  } = useEagerSessions({
    sort: { sortBy, order: sortOrder },
    filter: { status: selectedStatuses },
  })
  const [manualRefreshing, setManualRefreshing] = useState(false)

  const handleSessionsRefresh = async () => {
    setManualRefreshing(true)
    try {
      await refetchSessions()
    } finally {
      setManualRefreshing(false)
    }
  }

  const visibleSessions = useMemo(
    () => sessions.filter((s) => displayedServerIds.includes(s.serverId)),
    [sessions, displayedServerIds],
  )

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

  // No focus refetch — useQuery's staleTime (60s) plus WS session_update
  // deltas keep this list fresh. Forcing a refetch on every navigation back
  // to /index turned into a polling storm at 3 servers × N pages per focus.

  const { conversations, loaded: convLoaded, total: convTotal, isDone: convDone, isCounting: convCounting } =
    useEagerConversations(undefined, refreshEpoch)

  const showConvProgress = !convDone && convLoaderMode === 'full'

  // Sessions cluster to the top of the merged list under the LIVE header
  // (running / waiting_input first, then idle), regardless of conversation
  // recency. Conversations stay chronologically sorted below. Matches the
  // brand "amber = now" frame: the user wants to see active work without
  // scrolling past archive chatter.
  const mergedClassicItems = useMemo((): MergedItem[] => {
    const liveStatuses: SessionStatus[] = ['running', 'waiting_input']
    const isLive = (s: MultiSession) => liveStatuses.includes(s.status)

    const liveSessions = visibleSessions
      .filter(isLive)
      .map((s) => ({ kind: 'session' as const, ms: lastActivityMs(s), item: s }))
      .sort((a, b) => b.ms - a.ms)

    const idleSessions = visibleSessions
      .filter((s) => !isLive(s))
      .map((s) => ({ kind: 'session' as const, ms: lastActivityMs(s), item: s }))
      .sort((a, b) => b.ms - a.ms)

    const convs = conversations
      .map((c) => ({ kind: 'conversation' as const, ms: Date.parse(c.lastActivity) || 0, item: c }))
      .sort((a, b) => b.ms - a.ms)

    return [...liveSessions, ...idleSessions, ...convs]
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
    <SafeAreaView style={styles.container} edges={['top']} testID="hub-screen">
      {activeServerIds.map((sid) => <SessionNamesSyncer key={sid} serverId={sid} />)}
      {/* Header */}
      <View style={styles.header}>
        {/* Left: brand */}
        <View style={styles.headerLeft}>
          <Image source={require('../assets/icon.png')} style={styles.headerIcon} />
          <Text style={styles.headerTitle}>{t('shared:app.title')}</Text>
          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={8}
            style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.5 : 1 }]}
            accessibilityLabel={t('settings:header.title')}
          >
            <Gear size={20} color={dark.text.secondary} />
          </Pressable>
        </View>

        {/* Right: actions */}
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => setStatusModalOpen(true)}
            hitSlop={8}
            style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.5 : 1 }]}
            accessibilityLabel="Server status"
          >
            <Cloud size={20} color={dark.text.secondary} />
            {!allConnected ? (
              <View style={[styles.notifDot, { backgroundColor: someConnected ? dark.status.waiting : dark.status.failed }]} />
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => setSearchOpen((v) => !v)}
            hitSlop={8}
            style={({ pressed }) => [styles.headerButton, searchOpen && styles.headerButtonActive, { opacity: pressed ? 0.5 : 1 }]}
            accessibilityLabel="Search"
          >
            <MagnifyingGlass size={20} color={searchOpen ? dark.text.primary : dark.text.secondary} />
          </Pressable>
          <Pressable
            onPress={() => setSheetOpen(true)}
            hitSlop={8}
            style={({ pressed }) => [styles.headerButton, isSheetActive && styles.headerButtonActive, { opacity: pressed ? 0.5 : 1 }]}
            accessibilityLabel={t('filter.label')}
            testID="filter-sort-button"
          >
            <SlidersHorizontal size={20} color={isSheetActive ? dark.text.accent : dark.text.secondary} />
            {isSheetActive ? <View style={styles.activeDot} /> : null}
          </Pressable>
        </View>
      </View>

      {/* Quick Access Strip */}
      <QuickAccessStrip />

      {/* Content */}
      {sessionsLayout === 'tree' ? (
        <TreeSessionsList
          sessions={visibleSessions}
          conversations={conversations}
          refreshing={manualRefreshing}
          onRefresh={handleSessionsRefresh}
          searchOpen={searchOpen}
        />
      ) : sessionsLayout === 'hub' ? (
        <ProjectHubList
          sessions={visibleSessions}
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
                    {t('header.title')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentTab, classicTab === 'history' && styles.segmentTabActive]}
                  onPress={() => setClassicTab('history')}
                >
                  <Books size={13} color={classicTab === 'history' ? dark.text.primary : dark.text.secondary} />
                  <Text style={[styles.segmentText, classicTab === 'history' && styles.segmentTextActive]}>
                    {t('header.history')}
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

      <SessionsLoadingOverlay
        visible={!sessionsDone}
        loaded={sessionsLoaded}
        total={sessionsTotal}
        serverLabel={currentServerLabel}
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
  const { t } = useTranslation('sessions')
  const router = useRouter()
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const servers = useServersStore((s) => s.servers)
  const showServerHeaders = activeServerIds.length > 1

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

  type ClassicFlatItem =
    | { kind: 'header'; serverId: string; serverLabel: string; totalCount: number }
    | { kind: 'liveHeader'; id: string; count: number; hasLive: boolean }
    | MergedItem

  const flatData = useMemo((): ClassicFlatItem[] => {
    // Single-server: inject one LIVE/IDLE eyebrow above the contiguous
    // session block at the top. Sessions are already clustered first by
    // mergedClassicItems' sort (live → idle → conversations).
    if (!showServerHeaders) {
      const sessionItems = filteredItems.filter((it) => it.kind === 'session')
      if (sessionItems.length === 0) return filteredItems
      const hasLive = sessionItems.some((it) => {
        const s = it.item as MultiSession
        return s.status === 'running' || s.status === 'waiting_input'
      })
      return [
        { kind: 'liveHeader', id: 'live-header', count: sessionItems.length, hasLive },
        ...filteredItems,
      ]
    }

    const buckets = new Map<string, MergedItem[]>()
    for (const id of activeServerIds) buckets.set(id, [])
    for (const item of filteredItems) {
      const sid = item.item.serverId
      buckets.get(sid)?.push(item)
    }

    const result: ClassicFlatItem[] = []
    for (const id of activeServerIds) {
      const bucket = buckets.get(id) ?? []
      if (bucket.length === 0) continue
      result.push({
        kind: 'header',
        serverId: id,
        serverLabel: servers[id]?.label ?? id,
        totalCount: bucket.length,
      })
      result.push(...bucket)
    }
    return result
  }, [filteredItems, showServerHeaders, activeServerIds, servers])

  const renderConvCard = useCallback(
    (item: MultiConversation) => (
      <TouchableOpacity
        style={styles.convCard}
        activeOpacity={0.75}
        onPress={() => router.push(`/conversation/${item.id}?server=${item.serverId}`)}
      >
        <View style={styles.convCardTitleRow}>
          <FolderSimple size={18} color={dark.text.secondary} weight="fill" />
          <Text style={styles.convCardTitle} numberOfLines={1}>
            {item.title || item.projectPath}
          </Text>
        </View>
        {item.preview ? (
          <Text style={styles.convCardPreview} numberOfLines={2}>{item.preview}</Text>
        ) : null}
        <Text style={styles.convCardMeta}>
          {t('hub.msgs', { count: item.messageCount })}
        </Text>
      </TouchableOpacity>
    ),
    [router],
  )

  return (
    <View style={{ flex: 1 }}>
      {searchOpen ? (
        <View style={searchStyles.searchBar}>
          <TextInput
            style={searchStyles.searchInput}
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder={t('search.placeholder')}
            placeholderTextColor={dark.text.secondary}
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      ) : null}
      <FlatList
        data={flatData}
        keyExtractor={(item) => {
          if (item.kind === 'header') return `header-${item.serverId}`
          if (item.kind === 'liveHeader') return item.id
          if (item.kind === 'session') return `session:${item.item.serverId}::${item.item.id}`
          return `conversation:${item.item.serverId}::${item.item.id}`
        }}
        renderItem={({ item }) => {
          if (item.kind === 'header') {
            return <ServerHeaderRow serverLabel={item.serverLabel} totalCount={item.totalCount} />
          }
          if (item.kind === 'liveHeader') {
            return <LiveSessionsHeader count={item.count} hasLive={item.hasLive} />
          }
          if (item.kind === 'session') {
            return <SessionCard session={item.item as MultiSession} />
          }
          return renderConvCard(item.item as MultiConversation)
        }}
        contentContainerStyle={styles.mergedContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={dark.text.secondary} />
        }
      />
    </View>
  )
}


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
