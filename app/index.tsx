import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDebounce } from 'use-debounce'
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useEagerSessions } from '@/hooks/useSession'
import { useConversations, useConversationSearch } from '@/hooks/useConversations'
import { useProjectSummaries } from '@/hooks/useProjectSummaries'
import { useServersStore } from '@/stores/servers'
import { useLiveInstanceCount } from '@/lib/openTrace'
import { useSettingsStore } from '@/stores/settings'
import { useTreeDrillStore } from '@/stores/treeDrill'
import { useFetchSessionNames } from '@/hooks/useSessionName'
import { wsManager } from '@/services/ws-client'
import { ProjectHubList } from '@/components/sessions/hub/ProjectHubList'
import { ConversationList } from '@/components/conversation/ConversationList'
import { NowList } from '@/components/sessions/now/NowList'
import type { MergedItem } from '@/components/sessions/now/mergedItems'
import { TreeSessionsList } from '@/components/sessions/tree/TreeSessionsList'
import { SyncCachedNotice } from '@/components/sessions/SyncCachedNotice'
import { FilterSortSheet } from '@/components/servers/FilterSortSheet'
import { isPresentationLive } from '@/lib/sessionPresentation'
import { ServersStatusModal } from '@/components/servers/ServersStatusModal'
import { ServerErrorModal } from '@/components/servers/ServerErrorModal'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { FAB } from '@/components/ui/FAB'
import { EmptyState } from '@/components/ui/EmptyState'
import { NoServersWelcome } from '@/components/servers/NoServersWelcome'
import { NewSessionServerPicker } from '@/components/servers/NewSessionServerPicker'
import { MagnifyingGlass, SlidersHorizontal, BellRinging, Lightning, Books, Gear } from 'phosphor-react-native'
import { QuickAccessStrip } from '@/components/quick-access/QuickAccessStrip'
import { clientLog } from '@/lib/clientLog'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { ServerIndexingBanner } from '@/components/servers/ServerIndexingBanner'
import { EncryptionRefusalBanner } from '@/components/servers/EncryptionRefusalBanner'
import { CacheAlertBanner } from '@/components/servers/CacheAlertBanner'
import { CacheAlertModal } from '@/components/servers/CacheAlertModal'
import { HostPressureBanner } from '@/components/servers/HostPressureBanner'
import { ServerStateMessage } from '@/components/servers/ServerStateMessage'
import { ToastViewport } from '@/components/ui/ToastViewport'
import { brand, font, spacing, type Theme } from '@/constants/theme'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'
import type { MultiSession, MultiConversation } from '@/types/api'
import type { SortBy, SortOrder } from '@/types/ui'
import { DEFAULT_FILTERS, applyListFilters, countByProvider, countByTier, isDefaultFilters, type ListFilters } from '@/lib/sessionFilters'


// Stable empty reference so a memo/child does not see a fresh [] each render
// while the paginated query is disabled or still loading its first page.
const EMPTY_CONVERSATIONS: MultiConversation[] = []

type ClassicTab = 'sessions' | 'history'

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
  const [browseErrorServerId, setBrowseErrorServerId] = useState<string | null>(null)
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

  // Order and filters. Tier, agent and recency filter client-side: the wire
  // only knows three statuses, and an empty status list used to mean "all".
  const [sortBy, setSortBy] = useState<SortBy>('state')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [filters, setFilters] = useState<ListFilters>(DEFAULT_FILTERS)
  // The grouped views sort by recency when the Now list is in state order.
  const groupedSortBy: SortBy = sortBy === 'state' ? 'lastActivity' : sortBy
  const isSheetActive =
    sortBy !== 'state' ||
    sortOrder !== 'desc' ||
    !isDefaultFilters(filters) ||
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
    retryFailed,
    isRetrying: isRetryingFailedServers,
  } = useEagerSessions({
    sort: { sortBy, order: sortOrder },
  })
  const [manualRefreshing, setManualRefreshing] = useState(false)

  const visibleSessions = useMemo(
    () => sessions.filter((s) => displayedServerIds.includes(s.serverId)),
    [sessions, displayedServerIds],
  )
  // The grouped views take sessions, so the same filters run over those alone.
  const filteredSessions = useMemo(
    () =>
      applyListFilters(
        visibleSessions.map((s) => ({ kind: 'session' as const, ms: lastActivityMs(s), item: s })),
        filters,
      ).map((it) => it.item as MultiSession),
    [visibleSessions, filters],
  )

  // Conversations data
  const [refreshEpoch, setRefreshEpoch] = useState(0)

  // Unified refresh — always reloads both sessions and conversations.
  const handleRefresh = useCallback(async () => {
    setManualRefreshing(true)
    setRefreshEpoch((e) => e + 1)
    try {
      await refetchSessions()
    } finally {
      setManualRefreshing(false)
    }
  }, [refetchSessions])

  // ADR 0001 step 2: the grouped views (tree, hub) render their structure from
  // /api/projects/summary and fetch a project's conversations only when it is
  // opened.
  const isGroupedLayout = sessionsLayout === 'tree' || sessionsLayout === 'hub'

  const {
    summaries,
    unsupportedServerIds,
    isLoading: summariesLoading,
    isFetching: summariesFetching,
  } = useProjectSummaries(refreshEpoch, { enabled: isGroupedLayout })

  // ADR 0001 step 2 complete: every classic surface that shows conversations now
  // reads the infinite `useConversations`, so the eager full-drain is gone. Both
  // classic conversation surfaces share this one query — the merged list and the
  // History tab — so switching between them reuses pages already fetched instead
  // of restarting the walk.
  // See docs/adr/0001-hub-data-layer-lazy-pagination.md.
  const needsClassicConversations = !isGroupedLayout && (mergeChats || classicTab === 'history')
  // One agent selected narrows the paged query server-side; any other mix is
  // filtered here, where the rows already are.
  const convPages = useConversations(
    filters.providers.length === 1 ? { provider: filters.providers[0] } : undefined,
    refreshEpoch,
    { enabled: needsClassicConversations },
  )
  const loadMoreConversations = () => {
    if (convPages.hasNextPage && !convPages.isFetchingNextPage) void convPages.fetchNextPage()
  }
  const paginatedConversations = useMemo(
    () => convPages.data?.pages.flatMap((p) => p.conversations) ?? EMPTY_CONVERSATIONS,
    [convPages.data],
  )

  // The persisted React Query cache rehydrates sessions/conversations
  // synchronously on cold start, so a warm cache already has rows here before
  // the refetch resolves. Show the blocking modal ONLY when there is nothing
  // cached to show (fresh install / cache cleared); any warm state gets the
  // unobtrusive "Showing cached data" spinner instead.
  // The classic conversation query is disabled on the sessions tab, and a
  // disabled query never reports progress. Gating both derivations on
  // `needsClassicConversations` keeps that from reading as "still fetching
  // forever", which would pin the blocking modal open whenever there are also
  // no sessions to show.
  const hasCachedData =
    sessions.length > 0 || (isGroupedLayout ? summaries.length > 0 : paginatedConversations.length > 0)
  const isStillFetching =
    !sessionsDone ||
    (isGroupedLayout ? summariesLoading : needsClassicConversations && convPages.isLoading)
  const showLoadingModal = !hasCachedData && isStillFetching
  const isBackgroundRefreshing =
    hasCachedData &&
    (!sessionsDone ||
      (isGroupedLayout ? summariesFetching : needsClassicConversations && convPages.isFetching))
  // Single-server has no server-name rows to host the cached-data chip, so the
  // notice overlays the list: centered banner in Hub/Tree, caption under the
  // header fallback spinner in Classic. Multi-server is covered by the chips.
  const showSyncNotice = isBackgroundRefreshing && activeServerIds.length <= 1
  const syncNoticeVariant = sessionsLayout === 'tree' || sessionsLayout === 'hub' ? 'banner' : 'caption'
  const allServersFailed =
    activeServerIds.length > 0 &&
    sessionsDone &&
    activeServerIds.every((serverId) => fetchStatuses[serverId]?.status === 'error')

  // Sessions cluster to the top of the merged list under the LIVE header
  // (running / waiting_input first, then idle), regardless of conversation
  // recency. Conversations stay chronologically sorted below. Matches the
  // brand "amber = now" frame: the user wants to see active work without
  // scrolling past archive chatter.
  const mergedClassicItems = useMemo((): MergedItem[] => {
    const isLive = (s: MultiSession) => isPresentationLive(s)

    const liveSessions = visibleSessions
      .filter(isLive)
      .map((s) => ({ kind: 'session' as const, ms: lastActivityMs(s), item: s }))
      .sort((a, b) => b.ms - a.ms)

    const idleSessions = visibleSessions
      .filter((s) => !isLive(s))
      .map((s) => ({ kind: 'session' as const, ms: lastActivityMs(s), item: s }))
      .sort((a, b) => b.ms - a.ms)

    // While a search is active, take conversations from the server rather than
    // from the paged set: /api/search matches message bodies, so it finds
    // conversations that were never paged in. Filtering the loaded pages alone
    // makes anything past the current page unfindable.
    //
    // Sessions are concatenated ahead of conversations rather than co-sorted, so
    // the contract survives pagination by construction: a conversation arriving
    // on page 3 still lands below every session, and no session can be pushed
    // off-screen by conversation loading.
    const convSource = debouncedConvSearch
      ? (convSearchData?.conversations ?? [])
      : paginatedConversations

    const convs = convSource
      .map((c) => ({ kind: 'conversation' as const, ms: Date.parse(c.lastActivity) || 0, item: c }))
      .sort((a, b) => b.ms - a.ms)

    return [...liveSessions, ...idleSessions, ...convs]
  }, [visibleSessions, paginatedConversations, debouncedConvSearch, convSearchData])

  const filteredItems = useMemo(() => applyListFilters(mergedClassicItems, filters), [mergedClassicItems, filters])
  const sessionOnlyItems = useMemo(
    () => filteredItems.filter((it) => it.kind === 'session'),
    [filteredItems],
  )
  const tierCounts = useMemo(() => countByTier(mergedClassicItems), [mergedClassicItems])
  const providerCounts = useMemo(() => countByProvider(mergedClassicItems), [mergedClassicItems])
  const resultCount = mergeChats || classicTab === 'sessions' ? (mergeChats ? filteredItems.length : sessionOnlyItems.length) : filteredItems.length

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

  // Every route into Browse goes through here, not just the picker: a single
  // active server skips the picker entirely, and it can be just as dead. Browse
  // would open on an error banner and an empty listing; show the error instead.
  const openBrowse = (serverId: string, path?: string) => {
    const unreachable =
      fetchStatuses[serverId]?.status === 'error' || Boolean(servers[serverId]?.connectionError)
    if (unreachable) {
      // Picker stays open behind the error, so closing the error returns to the
      // list rather than dumping the user back on the hub.
      setBrowseErrorServerId(serverId)
      return
    }
    setPickerVisible(false)
    router.push(browseHref(serverId, path))
  }

  const handleFABPress = () => {
    if (activeServerIds.length === 0) {
      setFabNoServerToast(true)
      setTimeout(() => setFabNoServerToast(false), 2500)
      return
    }
    if (currentDrill && activeServerIds.includes(currentDrill.serverId)) {
      openBrowse(currentDrill.serverId, currentDrill.path)
      return
    }
    if (activeServerIds.length === 1) {
      openBrowse(activeServerIds[0])
      return
    }
    setPickerVisible(true)
  }

  const startSessionOn = (serverId: string) => {
    openBrowse(serverId)
  }

  const fabRef = useRef<View>(null)

  return (
    <SafeAreaView
      style={[styles.container, isGlass && styles.containerGlass]}
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
            style={({ pressed }) => [styles.headerButton, styles.headerStatusButton, { opacity: pressed ? 0.5 : 1 }]}
            accessibilityLabel={t('header.serverStatus')}
            testID="header-server-status-btn"
          >
            <BellRinging size={20} color={theme.text.secondary} />
            {!allConnected ? (
              <View style={[styles.notifDot, { backgroundColor: someConnected ? theme.status.waiting : theme.status.failed }]} />
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => setSearchOpen((v) => !v)}
            hitSlop={8}
            style={({ pressed }) => [styles.headerButton, searchOpen && styles.headerButtonActive, { opacity: pressed ? 0.5 : 1 }]}
            accessibilityLabel={t('search.accessibilityLabel')}
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

      <EncryptionRefusalBanner />

      <ToastViewport id="home" />

      <CacheAlertBanner onPress={() => {
        const lowSeverityId = displayedServerIds.find((id) => cacheAlert[id]?.severity === 'low')
        if (lowSeverityId) setCacheAlertModalServerId(lowSeverityId)
      }}
      />

      <HostPressureBanner />

      <ServerStateMessage
        activeServerIds={activeServerIds}
        servers={servers}
        fetchStatuses={fetchStatuses}
        wsConnectedCount={wsConnectedCount}
        onViewDetails={() => setStatusModalOpen(true)}
        onRetryFailed={() => retryFailed()}
        isRetrying={isRetryingFailedServers}
      />

      {/* Content */}
      <View style={styles.contentArea}>
      {activeServerIds.length === 0 && !hasEverHadServer ? (
        <NoServersWelcome />
      ) : allServersFailed ? (
        <EmptyState
          title={t('sessions:list.allServersOffline')}
          subtitle={t('sessions:list.allServersOfflineSubtitle')}
          action={{
            label: t('servers:action.details'),
            onPress: () => setStatusModalOpen(true),
          }}
          secondaryAction={{
            label: t('servers:action.retry'),
            onPress: () => retryFailed(),
          }}
        />
      ) : sessionsLayout === 'tree' ? (
        <TreeSessionsList
          sessions={filteredSessions}
          summaries={summaries}
          unsupportedServerIds={unsupportedServerIds}
          refreshing={manualRefreshing}
          onRefresh={handleRefresh}
          searchOpen={searchOpen}
          isBackgroundRefreshing={isBackgroundRefreshing}
        />
      ) : sessionsLayout === 'hub' ? (
        <ProjectHubList
          sessions={filteredSessions}
          summaries={summaries}
          unsupportedServerIds={unsupportedServerIds}
          sortBy={groupedSortBy}
          sortOrder={sortOrder}
          refreshing={manualRefreshing}
          onRefresh={handleRefresh}
          searchOpen={searchOpen}
          isBackgroundRefreshing={isBackgroundRefreshing}
        />
      ) : (
        <View style={styles.classicContainer}>
          {mergeChats ? (
            <NowList
              items={filteredItems}
              order={sortBy}
              direction={sortOrder}
              refreshing={manualRefreshing}
              onRefresh={handleRefresh}
              onEndReached={loadMoreConversations}
              searchOpen={searchOpen}
              searchQuery={classicConvSearch}
              conversationsFromServer={Boolean(debouncedConvSearch)}
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

              {classicTab === 'sessions' ? (
                <NowList
                  items={sessionOnlyItems}
                  order={sortBy}
                  direction={sortOrder}
                  refreshing={manualRefreshing}
                  onRefresh={handleRefresh}
                  searchOpen={searchOpen}
                  searchQuery={classicConvSearch}
                  conversationsFromServer={false}
                  onSearchChange={setClassicConvSearch}
                  isBackgroundRefreshing={isBackgroundRefreshing}
                />
              ) : (
                /* Classic history — ADR 0001 prototype: infinite pagination */
                <ConversationList
                  conversations={debouncedConvSearch ? (convSearchData?.conversations ?? []) : paginatedConversations}
                  onRefresh={handleRefresh}
                  refreshing={manualRefreshing}
                  onEndReached={loadMoreConversations}
                  searchQuery={classicConvSearch}
                  onSearchChange={setClassicConvSearch}
                  searchOpen={searchOpen}
                  isLoadingInitial={convPages.isLoading}
                  isFetchingNextPage={convPages.isFetchingNextPage}
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
        onRetrySessions={(serverId) => retryFailed([serverId])}
      />
      <FilterSortSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        order={sortBy}
        onChangeOrder={setSortBy}
        direction={sortOrder}
        onChangeDirection={setSortOrder}
        filters={filters}
        onChangeFilters={setFilters}
        tierCounts={tierCounts}
        providerCounts={providerCounts}
        resultCount={resultCount}
      />
      <NewSessionServerPicker
        visible={pickerVisible}
        serverIds={activeServerIds}
        servers={servers}
        fetchStatuses={fetchStatuses}
        onPick={startSessionOn}
        onClose={() => setPickerVisible(false)}
      />
      <ServerErrorModal
        visible={browseErrorServerId !== null}
        server={browseErrorServerId ? servers[browseErrorServerId] ?? null : null}
        onClose={() => setBrowseErrorServerId(null)}
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
        done={sessionsDone}
        loaded={sessionsLoaded}
        total={sessionsTotal}
        inFlightCount={sessionsInFlight}
      />

    </SafeAreaView>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg.primary,
  },
  containerGlass: {
    backgroundColor: 'transparent',
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
    end: 5,
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
  headerStatusButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
  },
  headerButtonActive: {
    backgroundColor: 'rgba(88,166,255,0.12)',
  },
  activeDot: {
    position: 'absolute',
    top: 4,
    end: 4,
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
  convCardTitleMatch: {
    backgroundColor: `${theme.text.accent}38`,
    color: theme.text.primary,
  },
  convCardPreviewMatch: {
    backgroundColor: `${theme.text.accent}38`,
    color: theme.text.primary,
  },
  convCardCodexBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: `${brand.codex}20`,
  },
  convCardClaudeBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: `${brand.claude}20`,
  },
  convCardCursorBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: `${brand.cursor}20`,
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
