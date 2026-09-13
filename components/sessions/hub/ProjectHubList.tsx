import React, { useState, useCallback, useMemo } from 'react'
import { FlatList, View, Text, SectionList, RefreshControl } from 'react-native'
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

  const groups = useProjectGroups(sessions, summaries, sortBy, sortOrder)

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
    | { kind: 'header'; serverId: string; serverLabel: string; totalCount: number }
    | { kind: 'group'; group: ProjectGroup }
    | { kind: 'serverEmpty'; serverId: string }
    | { kind: 'serverUnsupported'; serverId: string; serverLabel: string }

  const hubFlatData = useMemo((): HubFlatItem[] => {
    // Collapse only applies with more than one visible server; with a single
    // one a stale collapsed flag would hide its groups with no way to expand
    // (the header isn't collapsible below).
    const collapseApplies = serverGroups.length > 1
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
          const body: HubFlatItem[] =
            sg.totalCount > 0
              ? sg.groups.map((g) => ({ kind: 'group' as const, group: g }))
              : [{ kind: 'serverEmpty' as const, serverId: sg.serverId }]
          return [
            { kind: 'header' as const, serverId: sg.serverId, serverLabel: sg.serverLabel, totalCount: sg.totalCount },
            ...(expanded ? body : []),
          ]
        }), ...unsupportedRows]
      : [...groups.map((g) => ({ kind: 'group' as const, group: g })), ...unsupportedRows]
  }, [showServerHeaders, serverGroups, groups, collapsedServers, unsupportedServerIds, servers])

  if (drill && !searchOpen) {
    return <DrillView node={drill.node} serverId={drill.serverId} onBack={() => setDrill(null)} topInset={topInset} />
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
          />
        )
      ) : (
        <FlatList
          data={hubFlatData}
          keyExtractor={(item) => {
            if (item.kind === 'header') return `header-${item.serverId}`
            if (item.kind === 'serverEmpty') return `empty-${item.serverId}`
            if (item.kind === 'serverUnsupported') return `unsupported-${item.serverId}`
            return `project:${item.group.serverId}::${item.group.projectId}`
          }}
          renderItem={({ item }) => {
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
                />
              )
            }
            if (item.kind === 'serverEmpty') {
              const fetchStatus = fetchStatuses[item.serverId]?.status
              const isError = fetchStatus === 'error'
              // Third status is the warm-up / indexing state — treat non-ok/non-error as warming.
              const isWarming = fetchStatus != null && fetchStatus !== 'ok' && fetchStatus !== 'error'
              const emptyTitle = isError
                ? t('list.serverOffline')
                : isWarming
                  ? t('list.serverWarming')
                  : t('list.serverEmpty')
              const emptySubtitle = isError
                ? t('list.serverOfflineSubtitle')
                : isWarming
                  ? t('list.serverWarmingSubtitle')
                  : t('list.serverEmptySubtitle')
              return (
                <View style={styles.serverEmpty} testID={`server-empty-${item.serverId}`}>
                  <EmptyState title={emptyTitle} subtitle={emptySubtitle} />
                </View>
              )
            }
            return (
              <ProjectHubCard
                group={item.group}
                isOpen={openIds.has(item.group.projectId)}
                onToggle={toggleOpen}
                forceServerChip={shouldForceServerChip(item.group.projectPath, collidingPaths)}
                onBrowsePath={openDrill}
              />
            )
          }}
          {...LIST_WINDOW}
          {...inset.props}
          ListHeaderComponent={
            // The header is full-bleed; undo the card gutter around it.
            ListHeaderComponent ? <View style={{ marginHorizontal: -spacing.sm }}>{ListHeaderComponent}</View> : null
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text.secondary} />
          }
          contentContainerStyle={[hubFlatData.length === 0 ? styles.emptyListContent : styles.listContent, inset.contentStyle]}
          ListEmptyComponent={
            <View style={{ flex: 1 }}>
              <EmptyState title={t('list.empty')} subtitle={t('list.emptySubtitle')} />
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
