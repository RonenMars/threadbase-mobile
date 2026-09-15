import React, { useState, useCallback, useMemo } from 'react'
import { FlatList, View, Text, TextInput, SectionList, RefreshControl } from 'react-native'
import { MagnifyingGlass } from 'phosphor-react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useDebounce } from 'use-debounce'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useProjectGroups } from './useProjectGroups'
import { useServerGroups } from './useServerGroups'
import { ServerHeaderRow } from '@/components/sessions/tree/ServerHeaderRow'
import { DrillView } from '@/components/sessions/tree/DrillView'
import { buildTree, findProjectNode } from '@/components/sessions/tree/treeUtils'
import type { TreeNode } from '@/components/sessions/tree/types'
import { useConversationSearch } from '@/hooks/useConversations'
import { useServersStore } from '@/stores/servers'
import { useSessionNamesStore } from '@/stores/sessionNames'
import { conversationRowTitle, sessionRowTitle, storedNameFor } from '@/components/sessions/shared/rowTitle'
import { useNavLockStore } from '@/stores/navLock'
import { ProjectHubCard } from './ProjectHubCard'
import { QuietProjectChips } from './QuietProjectChips'
import { matchesProjectFilter, splitProjectTiers } from './projectTiers'
import { SectionEyebrow, type SectionTone } from '@/components/sessions/now/SectionEyebrow'
import { EmptyState } from '../../ui/EmptyState'
import { ConversationListItem } from '@/components/sessions/shared/ConversationListItem'
import { spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { isMultiSession } from './types'
import { makeStyles } from './ProjectHubList.styles'
import type { ProjectHubListProps, SearchSection } from './types'
import type { ProjectGroup } from './useProjectGroups'
import type { MultiSession, MultiConversation } from '@/types/api'
import { QuickAccessActionSheet } from '@/components/quick-access/QuickAccessActionSheet'
import { useQuickAccessStore, buildFavoriteId } from '@/stores/quickAccess'
import { useViewPrefsStore } from '@/stores/viewPrefs'
import { conversationHref } from '@/lib/conversationHref'
import { isExternalSession } from '@/lib/externalSession'
import { deriveSessionPresentation } from '@/lib/sessionPresentation'
import {
  collidingProjectPaths,
  shouldForceServerChip,
} from '@/lib/projectDisambiguation'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { LIST_WINDOW } from '@/components/sessions/shared/listWindow'
import { listTopInset } from '@/components/sessions/shared/listTopInset'

// Memoized: the Hub root re-renders on every fetch-progress tick; with stable
// props (query data is a stable ref mid-drain) this skips re-running the list.
export const ProjectHubList = React.memo(function ProjectHubList({
  sessions,
  summaries,
  sortBy,
  sortOrder,
  refreshing,
  onRefresh,
  searchOpen,
  searchQuery,
  isBackgroundRefreshing,
  unsupportedServerIds = [],
  topInset = 0,
  ListHeaderComponent,
  onNewSession,
  onScroll,
  onRetryServer,
  onOpenStatus,
}: ProjectHubListProps) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const styles = makeStyles(theme, insets.bottom)
  const inset = listTopInset(topInset)
  const router = useRouter()
  const { t } = useTranslation('sessions')
  const [debouncedQuery] = useDebounce(searchQuery, 300)
  // Tracks which groups are expanded, keyed by projectId (with projectPath
  // fallback during migration — see useProjectGroups).
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  // The path drill is the Tree layout's successor: built from the same
  // summaries, opened from a project card instead of a folder row.
  const [drill, setDrill] = useState<{ node: TreeNode; serverId: string } | null>(null)
  const openDrill = useCallback((group: ProjectGroup) => {
    const root = buildTree(
      sessions.filter((item) => item.serverId === group.serverId),
      summaries.filter((item) => item.serverId === group.serverId),
    )
    const node = findProjectNode(root, group.projectPath)
    if (node) setDrill({ node, serverId: group.serverId })
  }, [sessions, summaries])
  const [activeConvItem, setActiveConvItem] = useState<MultiConversation | null>(null)
  const { favorites, pinItem, unpinItem } = useQuickAccessStore()

  const allGroups = useProjectGroups(sessions, summaries, sortBy, sortOrder)
  // The path filter narrows cards by name or path; it is separate from the
  // chrome's search, which goes to the server for conversations.
  const [filterQuery, setFilterQuery] = useState('')
  const groups = useMemo(
    () => allGroups.filter((group) => matchesProjectFilter(group, filterQuery)),
    [allGroups, filterQuery],
  )
  // The QUIET tier stays folded into chips until shown; keyed per server so a
  // second machine's tail unfolds on its own.
  const [quietOpen, setQuietOpen] = useState<Set<string>>(() => new Set())
  const toggleQuiet = useCallback((scope: string) => {
    setQuietOpen((prev) => {
      const next = new Set(prev)
      if (next.has(scope)) next.delete(scope)
      else next.add(scope)
      return next
    })
  }, [])

  // Conversations live behind per-group queries now, so there is no local array
  // to filter — search goes to the server's /api/search, as classic does.
  const { data: convSearchData } = useConversationSearch(debouncedQuery)

  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const servers = useServersStore((s) => s.servers)
  const fetchStatuses = useServerFetchStatusStore((s) => s.statuses)
  const serverLabels = useMemo(
    () => Object.fromEntries(activeServerIds.map((id) => [id, servers[id]?.label ?? id])),
    [activeServerIds, servers],
  )
  const serverGroups = useServerGroups(groups, activeServerIds, serverLabels)
  const showServerHeaders = serverGroups.length > 0
  const collidingPaths = useMemo(
    () =>
      collidingProjectPaths([
        ...sessions,
        ...summaries.map((p) => ({ projectPath: p.path, serverId: p.serverId })),
      ]),
    [sessions, summaries],
  )
  const collapsedServers = useViewPrefsStore((s) => s.collapsedServers)
  const toggleServer = useViewPrefsStore((s) => s.toggleServerCollapsed)

  const toggleOpen = useCallback((projectId: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }, [])

  // A chip tap unfolds its tier and opens that card, so the tap lands where the
  // reader expects instead of on a row of chips that just rearranged.
  const openQuietProject = useCallback((scope: string, group: ProjectGroup) => {
    setQuietOpen((prev) => new Set(prev).add(scope))
    setOpenIds((prev) => new Set(prev).add(group.projectId))
  }, [])

  const handleConversationPress = useCallback(
    (item: MultiConversation) => {
      useNavLockStore.getState().lock()
      router.push(conversationHref(item.id, item.serverId, debouncedQuery))
    },
    [router, debouncedQuery],
  )

  const handleSessionPress = useCallback(
    (item: MultiSession) => {
      useNavLockStore.getState().lock()
      // External sessions are read-only — route to the conversation view, never
      // the PTY screen (which exposes the destructive Overtake / input paths).
      if (isExternalSession(item)) {
        const convId = item.boundConversationId ?? item.conversationId ?? item.id
        router.push(conversationHref(convId, item.serverId))
        return
      }
      router.push(`/session/${item.id}?server=${item.serverId}`)
    },
    [router],
  )

  const searchSections: SearchSection[] = React.useMemo(() => {
    if (!debouncedQuery) return []
    const q = debouncedQuery.toLowerCase()

    const matchedConversations = convSearchData?.conversations ?? []

    const matchedSessions = sessions.filter((s) =>
      s.projectName?.toLowerCase().includes(q) ||
      s.lastOutput?.toLowerCase().includes(q),
    )

    const result: SearchSection[] = []
    if (matchedConversations.length > 0) {
      result.push({
        title: `Conversations · ${matchedConversations.length} result${matchedConversations.length === 1 ? '' : 's'}`,
        data: matchedConversations,
        kind: 'conversation',
      })
    }
    if (matchedSessions.length > 0) {
      result.push({
        title: `Sessions · ${matchedSessions.length} result${matchedSessions.length === 1 ? '' : 's'}`,
        data: matchedSessions,
        kind: 'session',
      })
    }
    return result
  }, [debouncedQuery, convSearchData, sessions])

  const activeServerCount = activeServerIds.length
  const names = useSessionNamesStore((s) => s.names)
  const nameOrigins = useSessionNamesStore((s) => s.nameOrigin)

  const renderSearchResultItem = useCallback(
    ({ item }: { item: MultiConversation | MultiSession }) => {
      const isSession = isMultiSession(item)
      const serverColor = item.serverId ? servers[item.serverId]?.color : undefined
      const forceServerChip = shouldForceServerChip(item.projectPath, collidingPaths)
      if (isSession) {
        const { tier } = deriveSessionPresentation(item)
        return (
          <ConversationListItem
            testID={`session-row-${item.id}`}
            title={sessionRowTitle(item, storedNameFor(names, nameOrigins, item.serverId, item.id))}
            path={item.projectPath}
            timestamp={item.completedAt ?? item.startedAt}
            branch={item.branch}
            messageCount={item.promptCount}
            tier={tier}
            lastOutput={item.lastOutput || null}
            serverLabel={item.serverLabel}
            serverColor={serverColor}
            activeServerCount={activeServerCount}
            forceServerChip={forceServerChip}
            density="comfortable"
            leading="avatar"
            highlight={debouncedQuery}
            onPress={() => handleSessionPress(item)}
          />
        )
      }
      return (
        <ConversationListItem
          testID={`conversation-row-${item.id}`}
          title={conversationRowTitle(item, storedNameFor(names, nameOrigins, item.serverId, item.id))}
          path={item.projectPath}
          timestamp={item.lastMessage?.timestamp ?? item.lastActivity}
          messageCount={item.messageCount}
          branch={item.branch}
          firstMessage={item.firstMessage}
          lastMessage={item.lastMessage}
          preview={item.preview}
          matches={item.matches}
          serverLabel={item.serverLabel}
          serverColor={serverColor}
          activeServerCount={activeServerCount}
          forceServerChip={forceServerChip}
          density="comfortable"
          leading="avatar"
          highlight={debouncedQuery}
          provider={item.provider}
          onPress={() => handleConversationPress(item)}
          onLongPress={() => setActiveConvItem(item)}
        />
      )
    },
    [
      handleConversationPress,
      handleSessionPress,
      servers,
      activeServerCount,
      debouncedQuery,
      collidingPaths,
      names,
      nameOrigins,
    ],
  )

  const renderSectionHeader = useCallback(
    ({ section }: { section: SearchSection }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{section.title}</Text>
      </View>
    ),
    [styles.sectionHeader, styles.sectionHeaderText],
  )

  const showSearch = searchOpen && debouncedQuery.length > 0

  type HubFlatItem =
    | { kind: 'header'; serverId: string; serverLabel: string; totalCount: number; failed: boolean }
    | { kind: 'eyebrow'; key: string; label: string; tone: SectionTone; count?: number; action?: { label: string; onPress: () => void; testID?: string } }
    | { kind: 'group'; group: ProjectGroup }
    | { kind: 'quietChips'; key: string; scope: string; groups: ProjectGroup[] }
    | { kind: 'serverEmpty'; serverId: string }
    | { kind: 'serverUnsupported'; serverId: string; serverLabel: string }

  const hubFlatData = useMemo((): HubFlatItem[] => {
    // ACTIVE (a live session), RECENT (activity inside the window), QUIET (the
    // long tail). Quiet folds into chips only while there is something above it
    // to be quiet next to; a list that is all tail shows its cards.
    const tiered = (scoped: ProjectGroup[], scope: string): HubFlatItem[] => {
      const { active, recent, quiet } = splitProjectTiers(scoped)
      const out: HubFlatItem[] = []
      if (active.length > 0) {
        out.push({ kind: 'eyebrow', key: `${scope}-active`, tone: 'needsYou', label: `${t('hub.tierActive')} · ${active.length}` })
        out.push(...active.map((g) => ({ kind: 'group' as const, group: g })))
      }
      if (recent.length > 0) {
        out.push({ kind: 'eyebrow', key: `${scope}-recent`, tone: 'muted', label: t('hub.tierRecent'), count: recent.length })
        out.push(...recent.map((g) => ({ kind: 'group' as const, group: g })))
      }
      if (quiet.length > 0) {
        const foldable = active.length + recent.length > 0
        const folded = foldable && !quietOpen.has(scope)
        out.push({
          kind: 'eyebrow',
          key: `${scope}-quiet`,
          tone: 'muted',
          label: `${t('hub.tierQuiet')} · ${quiet.length}`,
          action: foldable
            ? { label: folded ? t('hub.showQuiet') : t('hub.hideQuiet'), onPress: () => toggleQuiet(scope), testID: `hub-quiet-toggle-${scope}` }
            : undefined,
        })
        if (folded) out.push({ kind: 'quietChips', key: `${scope}-quiet-chips`, scope, groups: quiet })
        else out.push(...quiet.map((g) => ({ kind: 'group' as const, group: g })))
      }
      return out
    }
    // Collapse only applies with more than one visible server; with a single
    // one a stale collapsed flag would hide its groups with no way to expand
    // (the header isn't collapsible below).
    const collapseApplies = serverGroups.length > 1
    const allFailed = activeServerIds.length > 0
      && activeServerIds.every((id) => fetchStatuses[id]?.status === 'error')
    // A server too old for /api/projects/summary gets its own row — omitting it
    // would read as "this server has no projects", which is not what happened.
    const unsupportedRows: HubFlatItem[] = unsupportedServerIds.map((serverId) => ({
      kind: 'serverUnsupported' as const,
      serverId,
      serverLabel: servers[serverId]?.label ?? serverId,
    }))
    return showServerHeaders
      ? [...serverGroups.flatMap((sg) => {
          const expanded = !collapseApplies || !collapsedServers.includes(sg.serverId)
          const failed = !allFailed && fetchStatuses[sg.serverId]?.status === 'error'
          const body: HubFlatItem[] =
            sg.totalCount > 0
              ? tiered(sg.groups, sg.serverId)
              : failed
                ? []
                : [{ kind: 'serverEmpty' as const, serverId: sg.serverId }]
          return [
            { kind: 'header' as const, serverId: sg.serverId, serverLabel: sg.serverLabel, totalCount: sg.totalCount, failed },
            ...(expanded ? body : []),
          ]
        }), ...unsupportedRows]
      : [...tiered(groups, 'all'), ...unsupportedRows]
  }, [showServerHeaders, serverGroups, groups, collapsedServers, unsupportedServerIds, servers, quietOpen, toggleQuiet, t, activeServerIds, fetchStatuses])

  if (drill && !searchOpen) {
    return <DrillView key={drill.node.fullPath} node={drill.node} serverId={drill.serverId} onBack={() => setDrill(null)} topInset={topInset} onScroll={onScroll} />
  }

  return (
    <View style={styles.container}>
      {showSearch ? (
        searchSections.length === 0 ? (
          <View style={{ flex: 1 }}>
            <EmptyState
              title={t('list.noResults')}
              subtitle={t('list.noResultsSubtitle', { query: debouncedQuery })}
            />
          </View>
        ) : (
          <SectionList
            sections={searchSections}
            // See app/index.tsx: without this the first tap on a result is
            // spent dismissing the search keyboard rather than opening the row.
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) =>
              isMultiSession(item)
                ? `session:${item.serverId}::${item.id}`
                : `conversation:${item.serverId}::${item.id}`
            }
            renderItem={renderSearchResultItem}
            renderSectionHeader={renderSectionHeader}
            {...inset.props}
            contentContainerStyle={[styles.listContent, inset.contentStyle]}
            stickySectionHeadersEnabled={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
          />
        )
      ) : (
        <FlatList
          data={hubFlatData}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => {
            if (item.kind === 'header') return `header-${item.serverId}`
            if (item.kind === 'eyebrow' || item.kind === 'quietChips') return item.key
            if (item.kind === 'serverEmpty') return `empty-${item.serverId}`
            if (item.kind === 'serverUnsupported') return `unsupported-${item.serverId}`
            return `project:${item.group.serverId}::${item.group.projectId}`
          }}
          renderItem={({ item }) => {
            if (item.kind === 'eyebrow') {
              return <SectionEyebrow label={item.label} tone={item.tone} count={item.count} action={item.action} />
            }
            if (item.kind === 'quietChips') {
              return <QuietProjectChips groups={item.groups} onPress={(group) => openQuietProject(item.scope, group)} />
            }
            if (item.kind === 'serverUnsupported') {
              return (
                <View style={styles.serverEmpty} testID={`server-unsupported-${item.serverId}`}>
                  <EmptyState
                    title={t('list.serverNeedsUpgrade')}
                    subtitle={t('list.serverNeedsUpgradeSubtitle', { server: item.serverLabel })}
                  />
                </View>
              )
            }
            if (item.kind === 'header') {
              return (
                <ServerHeaderRow
                  serverId={item.serverId}
                  serverLabel={item.serverLabel}
                  totalCount={item.totalCount}
                  collapsible={serverGroups.length > 1}
                  isExpanded={!collapsedServers.includes(item.serverId)}
                  onToggle={() => toggleServer(item.serverId)}
                  isRefreshing={isBackgroundRefreshing}
                  failed={item.failed}
                  onRetry={item.failed ? () => onRetryServer?.(item.serverId) : undefined}
                  onDetails={item.failed ? onOpenStatus : undefined}
                />
              )
            }
            if (item.kind === 'serverEmpty') {
              const fetchStatus = fetchStatuses[item.serverId]?.status
              // Fetch errors render on the section header. Warm-up / indexing is
              // the remaining non-ok empty, distinct from a host with no sessions.
              const isWarming = fetchStatus != null && fetchStatus !== 'ok' && fetchStatus !== 'error'
              return (
                <View style={styles.serverEmpty} testID={`server-empty-${item.serverId}`}>
                  <EmptyState
                    title={isWarming ? t('list.serverWarming') : t('list.serverEmpty')}
                    subtitle={isWarming ? t('list.serverWarmingSubtitle') : t('list.serverEmptySubtitle')}
                  />
                </View>
              )
            }
            return (
              <View style={fetchStatuses[item.group.serverId]?.status === 'error' ? { opacity: 0.6 } : undefined}>
                <ProjectHubCard
                  group={item.group}
                  isOpen={openIds.has(item.group.projectId)}
                  onToggle={toggleOpen}
                  forceServerChip={shouldForceServerChip(item.group.projectPath, collidingPaths)}
                  onBrowsePath={openDrill}
                />
              </View>
            )
          }}
          {...LIST_WINDOW}
          {...inset.props}
          ListHeaderComponent={
            // The header is full-bleed; undo the card gutter around it.
            <View style={{ marginHorizontal: -spacing.sm, paddingTop: spacing.xs }}>
              {ListHeaderComponent}
              <View style={styles.filterField}>
                <MagnifyingGlass size={14} color={theme.text.secondary} />
                <TextInput
                  testID="hub-project-filter"
                  style={styles.filterInput}
                  value={filterQuery}
                  onChangeText={setFilterQuery}
                  placeholder={t('hub.filterPlaceholder')}
                  placeholderTextColor={theme.text.secondary}
                  autoCorrect={false}
                  autoCapitalize="none"
                  clearButtonMode="while-editing"
                  returnKeyType="search"
                />
              </View>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.text.secondary}
              progressViewOffset={inset.progressViewOffset}
            />
          }
          contentContainerStyle={[hubFlatData.length === 0 ? styles.emptyListContent : styles.listContent, inset.contentStyle]}
          onScroll={onScroll}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <View style={{ flex: 1 }}>
              <EmptyState
                title={t('list.empty')}
                subtitle={t('list.emptySubtitle')}
                action={onNewSession ? { label: t('fab.newSession'), onPress: onNewSession, plus: true } : undefined}
              />
            </View>
          }
        />
      )}
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
              router.push(conversationHref(activeConvItem.id, activeConvItem.serverId, debouncedQuery))
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
})
