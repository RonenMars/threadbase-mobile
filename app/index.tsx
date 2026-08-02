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
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useEagerSessions } from '@/hooks/useSession'
import { useEagerConversations, useConversationSearch } from '@/hooks/useConversations'
import { useServersStore } from '@/stores/servers'
import { useNavLockStore } from '@/stores/navLock'
import { useLiveInstanceCount } from '@/lib/openTrace'
import { useSettingsStore } from '@/stores/settings'
import { useTreeDrillStore } from '@/stores/treeDrill'
import { useFetchSessionNames } from '@/hooks/useSessionName'
import { wsManager } from '@/services/ws-client'
import { ProjectHubList } from '@/components/sessions/hub/ProjectHubList'
import { ConversationList } from '@/components/conversation/ConversationList'
import { ClassicSessionsList } from '@/components/sessions/classic/ClassicSessionsList'
import { TreeSessionsList } from '@/components/sessions/tree/TreeSessionsList'
import { SessionCard } from '@/components/sessions/SessionCard'
import { SyncCachedNotice } from '@/components/sessions/SyncCachedNotice'
import { LiveSessionsHeader } from '@/components/sessions/LiveSessionsHeader'
import { ServerHeaderRow } from '@/components/sessions/tree/ServerHeaderRow'
import { FilterSortSheet } from '@/components/servers/FilterSortSheet'
import { ServersStatusModal } from '@/components/servers/ServersStatusModal'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { FAB } from '@/components/ui/FAB'
import { EmptyState } from '@/components/ui/EmptyState'
import { NoServersWelcome } from '@/components/servers/NoServersWelcome'
import { NewSessionServerPicker } from '@/components/servers/NewSessionServerPicker'
import { MagnifyingGlass, SlidersHorizontal, Cloud, Lightning, Books, Gear, FolderSimple } from 'phosphor-react-native'
import { QuickAccessStrip } from '@/components/quick-access/QuickAccessStrip'
import { QuickAccessActionSheet } from '@/components/quick-access/QuickAccessActionSheet'
import { useQuickAccessStore, buildFavoriteId } from '@/stores/quickAccess'
import { clientLog } from '@/lib/clientLog'
import { conversationHref } from '@/lib/conversationHref'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { ServerIndexingBanner } from '@/components/servers/ServerIndexingBanner'
import { CacheAlertBanner } from '@/components/servers/CacheAlertBanner'
import { CacheAlertModal } from '@/components/servers/CacheAlertModal'
import { ServerStateMessage } from '@/components/servers/ServerStateMessage'
import { brand, font, spacing, type Theme } from '@/constants/theme'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'
import { makeStyles as makeSearchStyles } from '@/components/sessions/SearchStyles'
import type { MultiSession, MultiConversation, SessionStatus } from '@/types/api'
import type { SortBy, SortOrder } from '@/types/ui'

const ALL_STATUSES: SessionStatus[] = ['running', 'waiting_input', 'idle']

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
  useLiveInstanceCount('ProjectsHub')
  const theme = useTheme()
  const isGlass = useIsGlass()
  const styles = makeStyles(theme)
  const { t } = useTranslation(['sessions', 'shared', 'settings', 'servers'])
  const router = useRouter()
  const sessionsLayout = useSettingsStore((s) => s.sessionsLayout)
  const mergeChats = useSettingsStore((s) => (s as any).mergeChats ?? false)
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const servers = useServersStore((s) => s.servers)
  const hasEverHadServer = useServersStore((s) => s.hasEverHadServer)

  useEffect(() => {
    clientLog.info('hub.mount', 'ProjectsHub mounted', {
      activeServerIdsLen: activeServerIds.length,
      displayedServerIdsLen: displayedServerIds.length,
      activeIds: activeServerIds,
      displayedIds: displayedServerIds,
      sessionsLayout,
    })
    // Mount-only diagnostic — captures the initial snapshot, must not re-fire on changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Connection status — a server is "healthy" only if WS is connected AND its
  // last HTTP fetch (Hub list, search, eager pagination) didn't fail. Either
  // signal flipping bad will degrade the dot from green to amber/red.
  const fetchStatuses = useServerFetchStatusStore((s) => s.statuses)
  const [wsConnectedCount, setWsConnectedCount] = useState(0)
  useEffect(() => {
    const updateCount = () => {
      let count = 0
      for (const id of activeServerIds) {
        if (wsManager.status(id) === 'connected') count++
      }
      setWsConnectedCount(count)
    }
    updateCount()
    const unsub = wsManager.onAnyStatusChange(() => updateCount())
    return unsub
  }, [activeServerIds])

  const healthyCount = useMemo(() => {
    let n = 0
    for (const id of activeServerIds) {
      const wsOk = wsManager.status(id) === 'connected'
      const fetchOk = (fetchStatuses[id]?.status ?? 'ok') === 'ok'
      if (wsOk && fetchOk) n++
    }
    return n
    // wsConnectedCount is the trigger for ws status changes — without it,
    // useMemo won't recompute when ws flips connected/disconnected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeServerIds, fetchStatuses, wsConnectedCount])

  const cacheAlert = useServersStore((s) => s.cacheAlert)

  const serverCount = activeServerIds.length
  const allConnected = healthyCount === serverCount && serverCount > 0
  const someConnected = healthyCount > 0

  // Header controls
  const [searchOpen, setSearchOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [pickerVisible, setPickerVisible] = useState(false)
  const [fabNoServerToast, setFabNoServerToast] = useState(false)
  const [manualCacheAlertServerId, setManualCacheAlertServerId] = useState<string | null>(null)
  const [cacheAlertToast, setCacheAlertToast] = useState<string | null>(null)

  // Auto-open for a pending high-severity alert (derived, not stateful); the
  // low-severity banner can also open the modal manually via setCacheAlertModalServerId.
  // Both auto-close once the store no longer has an alert for that server
  // (e.g. resolved from another surface) since neither branch is sticky state.
  const highSeverityCacheAlertServerId = displayedServerIds.find(
    (id) => cacheAlert[id]?.severity === 'high',
  ) ?? null
  const cacheAlertModalServerId = highSeverityCacheAlertServerId
    ?? (manualCacheAlertServerId && cacheAlert[manualCacheAlertServerId] ? manualCacheAlertServerId : null)
  const setCacheAlertModalServerId = setManualCacheAlertServerId

  // Sort state (hub mode)
  const [sortBy, setSortBy] = useState<SortBy>('lastActivity')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Filter state (sessions)
  const [selectedStatuses, setSelectedStatuses] = useState<SessionStatus[]>(ALL_STATUSES)
  const [providerFilter, setProviderFilter] = useState<'claude-code' | 'codex-cli' | undefined>(undefined)
  const isSheetActive =
    sortBy !== 'lastActivity' ||
    sortOrder !== 'desc' ||
    selectedStatuses.length < ALL_STATUSES.length ||
    providerFilter !== undefined ||
    (activeServerIds.length > 1 && displayedServerIds.length < activeServerIds.length)

  // Classic tab
  const [classicTab, setClassicTab] = useState<ClassicTab>('sessions')
  const [classicConvSearch, setClassicConvSearch] = useState('')
  const [debouncedConvSearch] = useDebounce(classicConvSearch, 300)
  const { data: convSearchData } = useConversationSearch(debouncedConvSearch)

  useEffect(() => {
    if (!searchOpen) queueMicrotask(() => setClassicConvSearch(''))
  }, [searchOpen])

  // Sessions data — sort + status filter are now server-side. Per-server
  // selection (displayedServerIds) remains client-side because it's a UI
  // toggle the user can flip without re-querying.
  const {
    sessions,
    isDone: sessionsDone,
    loaded: sessionsLoaded,
    total: sessionsTotal,
    inFlightCount: sessionsInFlight,
    refetch: refetchSessions,
  } = useEagerSessions({
    sort: { sortBy, order: sortOrder },
    filter: { status: selectedStatuses },
  })
  const [manualRefreshing, setManualRefreshing] = useState(false)

  const visibleSessions = useMemo(
    () => sessions.filter((s) => displayedServerIds.includes(s.serverId)),
    [sessions, displayedServerIds],
  )

  // Conversations data
  const [refreshEpoch, setRefreshEpoch] = useState(0)
  const [convLoaderMode, setConvLoaderMode] = useState<'full' | 'minimal'>('full')

  // Unified refresh — always reloads both sessions and conversations.
  const handleRefresh = useCallback(async () => {
    setManualRefreshing(true)
    setConvLoaderMode('full')
    setRefreshEpoch((e) => e + 1)
    try {
      await refetchSessions()
    } finally {
      setManualRefreshing(false)
    }
  }, [refetchSessions])

  const { conversations, loaded: convLoaded, total: convTotal, isDone: convDone, isCounting: convCounting } =
    useEagerConversations(providerFilter ? { provider: providerFilter } : undefined, refreshEpoch)

  const showConvProgress = !convDone && convLoaderMode === 'full'

  // The persisted React Query cache rehydrates sessions/conversations
  // synchronously on cold start, so a warm cache already has rows here before
  // the refetch resolves. Show the blocking modal ONLY when there is nothing
  // cached to show (fresh install / cache cleared); any warm state gets the
  // unobtrusive "Showing cached data" spinner instead.
  const hasCachedData = sessions.length > 0 || conversations.length > 0
  const isStillFetching = !sessionsDone || showConvProgress
  const showLoadingModal = !hasCachedData && isStillFetching
  const isBackgroundRefreshing = hasCachedData && (!sessionsDone || !convDone)
  // Single-server has no server-name rows to host the cached-data chip, so the
  // notice overlays the list: centered banner in Hub/Tree, caption under the
  // header fallback spinner in Classic. Multi-server is covered by the chips.
  const showSyncNotice = isBackgroundRefreshing && activeServerIds.length <= 1
  const syncNoticeVariant = sessionsLayout === 'tree' || sessionsLayout === 'hub' ? 'banner' : 'caption'

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
  // When the user is drilled into a directory in TreeView, the drill store
  // holds { serverId, path } and we pre-fill the browse screen's cwd with
  // that path on the same server — bypassing the multi-server picker even if
  // multiple servers are active, because the user's intent is clearly that
  // server's directory.
  const currentDrill = useTreeDrillStore((s) => s.current)

  const browseHref = (serverId: string, path?: string) => {
    const params = new URLSearchParams({ server: serverId })
    if (path) params.set('path', path)
    return `/browse?${params.toString()}` as `/browse?${string}`
  }

  const handleFABPress = () => {
    if (activeServerIds.length === 0) {
      setFabNoServerToast(true)
      setTimeout(() => setFabNoServerToast(false), 2500)
      return
    }
    if (currentDrill && activeServerIds.includes(currentDrill.serverId)) {
      router.push(browseHref(currentDrill.serverId, currentDrill.path))
      return
    }
    if (activeServerIds.length === 1) {
      router.push(browseHref(activeServerIds[0]))
      return
    }
    setPickerVisible(true)
  }

  const startSessionOn = (serverId: string) => {
    setPickerVisible(false)
    router.push(browseHref(serverId))
  }

  const fabRef = useRef<View>(null)

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top']}
      testID="hub-screen"
    >
      {activeServerIds.map((sid) => <SessionNamesSyncer key={sid} serverId={sid} />)}
      {/* Header */}
      <View style={styles.header}>
        {/* Left: brand */}
        <View style={styles.headerLeft}>
          <Image source={require('../assets/icon.png')} style={styles.headerIcon} />
          <Text style={styles.headerTitle}>{t('shared:app.title')}</Text>
          <Pressable
            testID="hub-settings-btn"
            onPress={() => router.push('/settings')}
            hitSlop={8}
            style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.5 : 1 }]}
            accessibilityLabel={t('settings:header.title')}
          >
            <Gear size={20} color={theme.text.secondary} />
          </Pressable>
        </View>

        {/* Right: actions */}
        <View style={styles.headerRight}>
          {/* Background-refetch fallback spinner — only for the two
              view/server-count combos with no server-name row to anchor it
              (single-server Hub and Classic; Tree always has ServerRootRow) */}
          {isBackgroundRefreshing && activeServerIds.length <= 1 && sessionsLayout !== 'tree' ? (
            <ActivityIndicator size="small" color={theme.text.secondary} testID="header-background-refreshing" />
          ) : null}
          <Pressable
            onPress={() => setStatusModalOpen(true)}
            hitSlop={8}
            style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.5 : 1 }]}
            accessibilityLabel="Server status"
            testID="header-server-status-btn"
          >
            <Cloud size={20} color={theme.text.secondary} />
            {!allConnected ? (
              <View style={[styles.notifDot, { backgroundColor: someConnected ? theme.status.waiting : theme.status.failed }]} />
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => setSearchOpen((v) => !v)}
            hitSlop={8}
            style={({ pressed }) => [styles.headerButton, searchOpen && styles.headerButtonActive, { opacity: pressed ? 0.5 : 1 }]}
            accessibilityLabel="Search"
            testID="header-search-btn"
          >
            <MagnifyingGlass size={20} color={searchOpen ? theme.text.primary : theme.text.secondary} />
          </Pressable>
          <Pressable
            onPress={() => setSheetOpen(true)}
            hitSlop={8}
            style={({ pressed }) => [styles.headerButton, isSheetActive && styles.headerButtonActive, { opacity: pressed ? 0.5 : 1 }]}
            accessibilityLabel={t('filter.label')}
            testID="filter-sort-button"
          >
            <SlidersHorizontal size={20} color={isSheetActive ? theme.text.accent : theme.text.secondary} />
            {isSheetActive ? <View style={styles.activeDot} /> : null}
          </Pressable>
        </View>
      </View>

      {/* Quick Access Strip */}
      <QuickAccessStrip />

      {/* Shown while server is scanning/indexing conversations on first boot */}
      <ServerIndexingBanner />

      <CacheAlertBanner onPress={() => {
        const lowSeverityId = displayedServerIds.find((id) => cacheAlert[id]?.severity === 'low')
        if (lowSeverityId) setCacheAlertModalServerId(lowSeverityId)
      }}
      />

      <ServerStateMessage
        activeServerIds={activeServerIds}
        servers={servers}
        fetchStatuses={fetchStatuses}
        wsConnectedCount={wsConnectedCount}
        onViewDetails={() => setStatusModalOpen(true)}
      />

      {/* Content */}
      <View style={styles.contentArea}>
      {activeServerIds.length === 0 && !hasEverHadServer ? (
        <NoServersWelcome />
      ) : sessionsLayout === 'tree' ? (
        <TreeSessionsList
          sessions={visibleSessions}
          conversations={conversations}
          refreshing={manualRefreshing}
          onRefresh={handleRefresh}
          searchOpen={searchOpen}
          isBackgroundRefreshing={isBackgroundRefreshing}
        />
      ) : sessionsLayout === 'hub' ? (
        <ProjectHubList
          sessions={visibleSessions}
          conversations={conversations}
          sortBy={sortBy}
          sortOrder={sortOrder}
          refreshing={manualRefreshing}
          onRefresh={handleRefresh}
          searchOpen={searchOpen}
          isBackgroundRefreshing={isBackgroundRefreshing}
        />
      ) : (
        <View style={styles.classicContainer}>
          {mergeChats ? (
            // Merged: single chronological list of sessions + conversations
            <MergedClassicList
              items={mergedClassicItems}
              refreshing={manualRefreshing}
              onRefresh={handleRefresh}
              searchOpen={searchOpen}
              searchQuery={classicConvSearch}
              onSearchChange={setClassicConvSearch}
              isBackgroundRefreshing={isBackgroundRefreshing}
            />
          ) : (
            <>
              {/* Segmented control */}
              <View style={[styles.segmentRow, isGlass && styles.segmentRowGlass]}>
                <GlassFill />
                <TouchableOpacity
                  style={[styles.segmentTab, classicTab === 'sessions' && styles.segmentTabActive]}
                  onPress={() => setClassicTab('sessions')}
                >
                  <Lightning size={13} color={classicTab === 'sessions' ? theme.text.primary : theme.text.secondary} />
                  <Text style={[styles.segmentText, classicTab === 'sessions' && styles.segmentTextActive]}>
                    {t('header.title')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentTab, classicTab === 'history' && styles.segmentTabActive]}
                  onPress={() => setClassicTab('history')}
                  testID="hub-history-tab"
                >
                  <Books size={13} color={classicTab === 'history' ? theme.text.primary : theme.text.secondary} />
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
                  onRefresh={handleRefresh}
                  searchOpen={searchOpen}
                />
              ) : (
                /* Classic history */
                <ConversationList
                  conversations={debouncedConvSearch ? (convSearchData?.conversations ?? []) : conversations}
                  onRefresh={handleRefresh}
                  refreshing={showConvProgress}
                  onEndReached={() => {}}
                  searchQuery={classicConvSearch}
                  onSearchChange={setClassicConvSearch}
                  searchOpen={searchOpen}
                  isLoadingInitial={false}
                  isFetchingNextPage={false}
                  loadingProgress={null}
                />
              )}
            </>
          )}
        </View>
      )}
      <SyncCachedNotice visible={showSyncNotice} variant={syncNoticeVariant} />
      </View>

      {/* FAB */}
      {fabNoServerToast && (
        <View style={styles.fabToast} pointerEvents="none">
          <Text style={styles.fabToastText}>{t('sessions:fab.noServerHint')}</Text>
        </View>
      )}
      {cacheAlertToast && (
        <View style={styles.fabToast} pointerEvents="none">
          <Text style={styles.fabToastText}>{cacheAlertToast}</Text>
        </View>
      )}
      <FAB
        ref={fabRef}
        onPress={handleFABPress}
      />

      {/* Modals & Sheets */}
      <ServersStatusModal
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
        providerFilter={providerFilter}
        onChangeProviderFilter={(v) => setProviderFilter(v === undefined ? undefined : v)}
      />
      <NewSessionServerPicker
        visible={pickerVisible}
        serverIds={activeServerIds}
        servers={servers}
        onPick={startSessionOn}
        onClose={() => setPickerVisible(false)}
      />
      <CacheAlertModal
        visible={cacheAlertModalServerId !== null}
        serverId={cacheAlertModalServerId}
        onClose={() => setCacheAlertModalServerId(null)}
        onResolved={(backupPath) => {
          setCacheAlertModalServerId(null)
          const message = backupPath
            ? t('cacheAlert.successToast', { ns: 'servers', backupPath })
            : t('cacheAlert.successToastNoBackup', { ns: 'servers' })
          setCacheAlertToast(message)
          setTimeout(() => setCacheAlertToast(null), 3000)
        }}
      />

      <LoadingOverlay
        visible={showLoadingModal}
        sessionsDone={sessionsDone}
        loaded={sessionsLoaded}
        total={sessionsTotal}
        inFlightCount={sessionsInFlight}
        convLoaded={convLoaded}
        convTotal={convTotal}
        convDone={convDone}
        convCounting={convCounting}
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
  isBackgroundRefreshing,
}: {
  items: MergedItem[]
  refreshing: boolean
  onRefresh: () => void
  searchOpen: boolean
  searchQuery: string
  onSearchChange: (q: string) => void
  isBackgroundRefreshing?: boolean
}) {
  const theme = useTheme()
  const isGlass = useIsGlass()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const searchStyles = makeSearchStyles(theme)
  const { t } = useTranslation('sessions')
  const router = useRouter()
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const servers = useServersStore((s) => s.servers)
  const showServerHeaders = activeServerIds.length > 1
  const SESSIONS_COLLAPSE_THRESHOLD = 3
  const [activeConvItem, setActiveConvItem] = useState<MultiConversation | null>(null)
  const [collapsedServers, setCollapsedServers] = useState<Set<string>>(new Set())
  const [sessionsCollapsed, setSessionsCollapsed] = useState(
    () => items.filter((it) => it.kind === 'session').length > SESSIONS_COLLAPSE_THRESHOLD
  )
  const { favorites, pinItem, unpinItem } = useQuickAccessStore()

  const toggleServer = useCallback((serverId: string) => {
    setCollapsedServers((prev) => {
      const next = new Set(prev)
      if (next.has(serverId)) next.delete(serverId)
      else next.add(serverId)
      return next
    })
  }, [])

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

  const visibleServerCount = useMemo(
    () => new Set(filteredItems.map((it) => it.item.serverId)).size,
    [filteredItems],
  )

  type ClassicFlatItem =
    | { kind: 'header'; serverId: string; serverLabel: string; totalCount: number }
    | { kind: 'liveHeader'; id: string; count: number; hasLive: boolean; collapsed: boolean; collapsible: boolean }
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
      const collapsible = sessionItems.length > SESSIONS_COLLAPSE_THRESHOLD
      const nonSessionItems = filteredItems.filter((it) => it.kind !== 'session')
      return [
        { kind: 'liveHeader', id: 'live-header', count: sessionItems.length, hasLive, collapsed: sessionsCollapsed, collapsible },
        ...(collapsible && sessionsCollapsed ? [] : sessionItems),
        ...nonSessionItems,
      ]
    }

    const buckets = new Map<string, MergedItem[]>()
    for (const id of activeServerIds) buckets.set(id, [])
    for (const item of filteredItems) {
      const sid = item.item.serverId
      buckets.get(sid)?.push(item)
    }

    // Collapse only applies when more than one server actually has items;
    // with a single visible server a stale collapsed flag would otherwise
    // hide its sessions with no way to expand (header isn't collapsible).
    const serversWithItems = activeServerIds.filter((id) => (buckets.get(id)?.length ?? 0) > 0)
    const collapseApplies = serversWithItems.length > 1

    const result: ClassicFlatItem[] = []
    for (const id of serversWithItems) {
      const bucket = buckets.get(id) ?? []
      result.push({
        kind: 'header',
        serverId: id,
        serverLabel: servers[id]?.label ?? id,
        totalCount: bucket.length,
      })
      if (!collapseApplies || !collapsedServers.has(id)) result.push(...bucket)
    }
    return result
  }, [filteredItems, showServerHeaders, activeServerIds, servers, collapsedServers, sessionsCollapsed])

  // Find the index of the first session in the flat list
  const firstSessionIndex = useMemo(() => {
    return flatData.findIndex((item) => item.kind === 'session')
  }, [flatData])

  const renderConvCard = useCallback(
    (item: MultiConversation) => (
      <TouchableOpacity
        style={[styles.convCard, isGlass && styles.convCardGlass]}
        activeOpacity={0.75}
        onPress={() => {
          useNavLockStore.getState().lock()
          router.push(conversationHref(item.id, item.serverId, searchQuery))
        }}
        onLongPress={() => setActiveConvItem(item)}
        accessibilityLabel={item.title || item.projectPath}
        testID={`conversation-row-${item.id}`}
      >
        <GlassFill />
        <View style={styles.convCardTitleRow}>
          <FolderSimple size={18} color={theme.text.secondary} weight="fill" />
          <Text style={styles.convCardTitle} numberOfLines={1}>
            {item.title || item.projectPath}
          </Text>
          {item.provider != null ? (
            <View style={item.provider === 'codex-cli' ? styles.convCardCodexBadge : styles.convCardClaudeBadge}>
              <Text style={item.provider === 'codex-cli' ? styles.convCardCodexBadgeText : styles.convCardClaudeBadgeText}>
                {item.provider === 'codex-cli' ? 'Codex' : 'Claude'}
              </Text>
            </View>
          ) : null}
        </View>
        {item.preview ? (
          <Text style={styles.convCardPreview} numberOfLines={2}>{item.preview}</Text>
        ) : null}
        <Text style={styles.convCardMeta}>
          {t('hub.msgs', { count: item.messageCount })}
        </Text>
      </TouchableOpacity>
    ),
    [router, t, styles, theme, isGlass, searchQuery],
  )

  return (
    <View style={{ flex: 1 }}>
      {searchOpen ? (
        <View style={searchStyles.searchBar}>
          <TextInput
            testID="hub-search-input"
            style={searchStyles.searchInput}
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder={t('search.placeholder')}
            placeholderTextColor={theme.text.secondary}
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
        renderItem={({ item, index }) => {
          if (item.kind === 'header') {
            return (
              <ServerHeaderRow
                serverId={item.serverId}
                serverLabel={item.serverLabel}
                totalCount={item.totalCount}
                collapsible={visibleServerCount > 1}
                isExpanded={!collapsedServers.has(item.serverId)}
                onToggle={() => toggleServer(item.serverId)}
                isRefreshing={isBackgroundRefreshing}
              />
            )
          }
          if (item.kind === 'liveHeader') {
            return (
              <LiveSessionsHeader
                count={item.count}
                hasLive={item.hasLive}
                collapsed={item.collapsed}
                onToggle={item.collapsible ? () => setSessionsCollapsed((v) => !v) : undefined}
              />
            )
          }
          if (item.kind === 'session') {
            return <SessionCard session={item.item as MultiSession} isFirstSession={index === firstSessionIndex} />
          }
          return renderConvCard(item.item as MultiConversation)
        }}
        contentContainerStyle={styles.mergedContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text.secondary} />
        }
        ListEmptyComponent={
          <View style={{ flex: 1 }}>
            <EmptyState title={t('list.empty')} subtitle={t('list.emptySubtitle')} />
          </View>
        }
      />
      {activeConvItem ? (() => {
        const favId = buildFavoriteId(activeConvItem.serverId, 'conversation', activeConvItem.id)
        const isFav = favorites.some((f) => f.id === favId)
        return (
          <QuickAccessActionSheet
            item={{
              type: 'conversation',
              id: favId,
              label: activeConvItem.title || activeConvItem.projectPath || activeConvItem.id,
              serverId: activeConvItem.serverId,
            }}
            isFavorite={isFav}
            onClose={() => setActiveConvItem(null)}
            onNewSession={() => setActiveConvItem(null)}
            onBrowse={() => setActiveConvItem(null)}
            onOpenSession={() => {
              setActiveConvItem(null)
              useNavLockStore.getState().lock()
              router.push(conversationHref(activeConvItem.id, activeConvItem.serverId, searchQuery))
            }}
            onTogglePin={() => {
              if (isFav) {
                unpinItem(favId)
              } else {
                pinItem({
                  type: 'conversation',
                  id: favId,
                  label: activeConvItem.title || activeConvItem.projectPath || activeConvItem.id,
                  serverId: activeConvItem.serverId,
                  conversationId: activeConvItem.id,
                })
              }
              setActiveConvItem(null)
            }}
          />
        )
      })() : null}
    </View>
  )
}


function makeStyles(theme: Theme) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg.primary,
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
    color: theme.text.primary,
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
    borderColor: theme.bg.primary,
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
    backgroundColor: theme.text.accent,
  },
  contentArea: {
    flex: 1,
  },
  classicContainer: {
    flex: 1,
  },
  segmentRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: theme.bg.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  segmentRowGlass: {
    backgroundColor: 'transparent',
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
    backgroundColor: theme.bg.secondary,
  },
  segmentText: {
    color: theme.text.secondary,
    fontSize: font.sm,
    fontWeight: '500',
  },
  segmentTextActive: {
    color: theme.text.primary,
    fontWeight: '600',
  },
  mergedContent: {
    padding: spacing.sm,
    flexGrow: 1,
  },
  convCard: {
    backgroundColor: theme.bg.card,
    borderRadius: 10,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: theme.border,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  convCardGlass: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  convCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  convCardTitle: {
    flex: 1,
    color: theme.text.primary,
    fontSize: font.base,
    fontWeight: '600',
  },
  convCardPreview: {
    color: theme.text.secondary,
    fontSize: font.xs,
  },
  convCardMeta: {
    color: theme.text.secondary,
    fontSize: font.xs,
  },
  convCardCodexBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: `${brand.codex}20`,
  },
  convCardCodexBadgeText: {
    color: brand.codex,
    fontSize: font.xs - 2,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  convCardClaudeBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: `${brand.claude}20`,
  },
  convCardClaudeBadgeText: {
    color: brand.claude,
    fontSize: font.xs - 2,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  fabToast: {
    position: 'absolute',
    bottom: 88,
    alignSelf: 'center',
    backgroundColor: theme.bg.card,
    borderRadius: 8,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  fabToastText: {
    color: theme.text.secondary,
    fontSize: font.sm,
  },
})}

