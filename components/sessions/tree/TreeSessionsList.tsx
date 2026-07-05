import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { Text, View, TextInput, FlatList, SectionList, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useDebounce } from 'use-debounce'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { buildTree, compactTree, flattenVisible } from './treeUtils'
import { TreeRow } from './TreeRow'
import { DrillView } from './DrillView'
import { ServerRootRow } from './ServerRootRow'
import { EmptyState } from '../../ui/EmptyState'
import { ConversationListItem } from '@/components/sessions/shared/ConversationListItem'
import { LiveSessionsHeader } from '@/components/sessions/LiveSessionsHeader'
import { SessionCard } from '@/components/sessions/SessionCard'
import { useServersStore } from '@/stores/servers'
import { useTheme } from '@/contexts/ThemeContext'
import { makeStyles } from './TreeSessionsList.styles'
import { makeStyles as makeSearchStyles } from '../SearchStyles'
import type { FlatItem, ServerTree, TreeNode, TreeSessionsListProps } from './types'
import type { MultiSession, MultiConversation } from '@/types/api'
import { QuickAccessActionSheet } from '@/components/quick-access/QuickAccessActionSheet'
import { useQuickAccessStore, buildFavoriteId } from '@/stores/quickAccess'

export function TreeSessionsList({ sessions, conversations, refreshing, onRefresh, searchOpen, isBackgroundRefreshing }: TreeSessionsListProps) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const styles = makeStyles(insets.bottom)
  const searchStyles = makeSearchStyles(theme)
  const router = useRouter()
  const { t } = useTranslation('sessions')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery] = useDebounce(searchQuery, 300)
  const inputRef = useRef<TextInput>(null)
  const [activeConvItem, setActiveConvItem] = useState<MultiConversation | null>(null)
  const { favorites, pinItem, unpinItem } = useQuickAccessStore()

  useEffect(() => {
    if (!searchOpen) queueMicrotask(() => setSearchQuery(''))
  }, [searchOpen])

  const searchSections = useMemo(() => {
    if (!debouncedQuery) return []
    const q = debouncedQuery.toLowerCase()
    const matchedConversations = conversations.filter(
      (c) =>
        c.title?.toLowerCase().includes(q) ||
        c.preview?.toLowerCase().includes(q) ||
        c.firstMessage?.text?.toLowerCase().includes(q) ||
        c.lastMessage?.text?.toLowerCase().includes(q),
    )
    const matchedSessions = sessions.filter(
      (s) => s.projectName?.toLowerCase().includes(q) || s.lastOutput?.toLowerCase().includes(q),
    )
    const result: { title: string; data: (MultiConversation | MultiSession)[]; kind: 'conversation' | 'session' }[] = []
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
  }, [debouncedQuery, conversations, sessions])

  const activeServerCount = useServersStore((s) => s.activeServerIds.length)
  const servers = useServersStore((s) => s.servers)

  const renderSearchItem = useCallback(
    ({ item }: { item: MultiConversation | MultiSession }) => {
      const isSession = 'status' in item
      const serverColor = item.serverId ? servers[item.serverId]?.color : undefined
      if (isSession) {
        const s = item as MultiSession
        const isLive = s.status === 'running' || s.status === 'waiting_input'
        return (
          <ConversationListItem
            testID={`session-row-${s.id}`}
            title={s.projectName}
            path={s.projectPath}
            timestamp={s.completedAt ?? s.startedAt}
            branch={s.branch}
            messageCount={s.promptCount}
            live={isLive}
            lastOutput={s.lastOutput || null}
            serverLabel={s.serverLabel}
            serverColor={serverColor}
            activeServerCount={activeServerCount}
            density="comfortable"
            leading="avatar"
            highlight={debouncedQuery}
            onPress={() => router.push(`/session/${s.id}?server=${s.serverId}`)}
          />
        )
      }
      const c = item as MultiConversation
      return (
        <ConversationListItem
          testID={`conversation-row-${c.id}`}
          title={c.title}
          path={c.projectPath}
          timestamp={c.lastMessage?.timestamp ?? c.lastActivity}
          messageCount={c.messageCount}
          branch={c.branch}
          firstMessage={c.firstMessage}
          lastMessage={c.lastMessage}
          preview={c.preview}
          serverLabel={c.serverLabel}
          serverColor={serverColor}
          activeServerCount={activeServerCount}
          density="comfortable"
          leading="avatar"
          highlight={debouncedQuery}
          provider={c.provider}
          onPress={() => router.push(`/conversation/${c.id}?server=${c.serverId}`)}
          onLongPress={() => setActiveConvItem(c)}
        />
      )
    },
    [router, servers, activeServerCount, debouncedQuery],
  )
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [collapsedServers, setCollapsedServers] = useState<Set<string>>(new Set())
  const SESSIONS_COLLAPSE_THRESHOLD = 3
  const [sessionsCollapsed, setSessionsCollapsed] = useState(
    () => sessions.length > SESSIONS_COLLAPSE_THRESHOLD
  )
  const [selectedDrill, setSelectedDrill] = useState<{ node: TreeNode; serverId: string } | null>(null)

  const serverTrees = useMemo((): ServerTree[] => {
    const serverIds: string[] = []
    const serverLabels: Record<string, string> = {}

    for (const s of sessions) {
      if (!serverLabels[s.serverId]) {
        serverIds.push(s.serverId)
        serverLabels[s.serverId] = s.serverLabel ?? s.serverId
      }
    }
    for (const c of conversations) {
      if (!serverLabels[c.serverId]) {
        serverIds.push(c.serverId)
        serverLabels[c.serverId] = c.serverLabel ?? c.serverId
      }
    }

    return serverIds.map((serverId) => {
      const sSessions = sessions.filter((s) => s.serverId === serverId)
      const sConversations = conversations.filter((c) => c.serverId === serverId)
      const raw = buildTree(sSessions, sConversations)
      const tree = compactTree(raw)

      const singleRootPath = tree.children.size === 1
        ? Array.from(tree.children.values())[0].fullPath
        : null
      const singleRootNode = singleRootPath
        ? Array.from(tree.children.values())[0]
        : null

      return { serverId, serverLabel: serverLabels[serverId], tree, singleRootPath, singleRootNode }
    })
  }, [sessions, conversations])

  const effectiveExpandedPaths = useMemo(() => {
    const merged = new Set(expandedPaths)
    // Auto-expand the single-root case as before.
    for (const { singleRootPath } of serverTrees) {
      if (singleRootPath) merged.add(singleRootPath)
    }
    // Auto-expand the dominant top-level child when one root holds an
    // overwhelming majority of items (e.g. /Users/<me>/* on a personal Mac).
    // Without this, all live sessions sit collapsed under that root and the
    // hub looks empty even when it isn't. Threshold of 80% balances "obvious
    // dominant root" against "two roots of comparable size".
    for (const { tree } of serverTrees) {
      if (tree.totalCount === 0 || tree.children.size <= 1) continue
      for (const child of tree.children.values()) {
        if (child.totalCount / tree.totalCount >= 0.8) {
          merged.add(child.fullPath)
        }
      }
    }
    return merged
  }, [expandedPaths, serverTrees])

  const flatItems = useMemo((): FlatItem[] => {
    const items: FlatItem[] = []
    const visibleServerCount = serverTrees.filter((st) => st.tree.totalCount > 0).length
    const multiServer = visibleServerCount > 1
    for (const { serverId, serverLabel, tree, singleRootPath, singleRootNode } of serverTrees) {
      if (tree.totalCount === 0) continue
      const serverExpanded = !collapsedServers.has(serverId)
      if (singleRootNode && singleRootPath) {
        items.push({ kind: 'server-root', serverId, serverLabel, node: singleRootNode, collapsible: multiServer, isExpanded: serverExpanded })
        if (!multiServer || serverExpanded) {
          for (const fn of flattenVisible(singleRootNode.children, 1, effectiveExpandedPaths)) {
            items.push({ kind: 'tree-row', serverId, node: fn.node, depth: fn.depth + (multiServer ? 1 : 0), depthOffset: 0 })
          }
        }
      } else {
        items.push({ kind: 'server-root', serverId, serverLabel, node: tree, collapsible: multiServer, isExpanded: serverExpanded })
        if (!multiServer || serverExpanded) {
          const depthShift = multiServer ? 1 : 0
          for (const fn of flattenVisible(tree.children, 0, effectiveExpandedPaths)) {
            items.push({ kind: 'tree-row', serverId, node: fn.node, depth: fn.depth + depthShift, depthOffset: 0 })
          }
        }
      }
    }
    return items
  }, [serverTrees, effectiveExpandedPaths, collapsedServers])

  const handleToggle = useCallback((path: string) => {
    if (serverTrees.some((st) => st.singleRootPath === path)) return
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [serverTrees])

  const handleToggleServer = useCallback((serverId: string) => {
    setCollapsedServers((prev) => {
      const next = new Set(prev)
      if (next.has(serverId)) next.delete(serverId)
      else next.add(serverId)
      return next
    })
  }, [])

  const handleSelectLeaf = useCallback((node: TreeNode, serverId: string) => {
    setSelectedDrill({ node, serverId })
  }, [])

  // Surface sessions above the tree so live + recently-used sessions remain
  // visible regardless of where they nest under the path tree (otherwise a
  // user with everything under /Users/<me>/... sees a collapsed root and
  // wonders where their sessions went). Computed before any conditional return
  // to keep hook order stable.
  const liveSessionsBlock = useMemo(() => {
    if (sessions.length === 0) return null
    const hasLive = sessions.some(
      (s) => s.status === 'running' || s.status === 'waiting_input',
    )
    const collapsible = sessions.length > SESSIONS_COLLAPSE_THRESHOLD
    return (
      <View style={{ marginBottom: 4 }}>
        <LiveSessionsHeader
          count={sessions.length}
          hasLive={hasLive}
          collapsed={sessionsCollapsed}
          onToggle={collapsible ? () => setSessionsCollapsed((v) => !v) : undefined}
        />
        {(!collapsible || !sessionsCollapsed) && sessions.map((s) => (
          <SessionCard key={`${s.serverId}::${s.id}`} session={s} />
        ))}
      </View>
    )
  }, [sessions, sessionsCollapsed, SESSIONS_COLLAPSE_THRESHOLD])

  if (selectedDrill && !searchOpen) {
    return (
      <DrillView
        node={selectedDrill.node}
        serverId={selectedDrill.serverId}
        onBack={() => setSelectedDrill(null)}
      />
    )
  }

  const showSearch = searchOpen && debouncedQuery.length > 0

  return (
    <View style={{ flex: 1 }}>
      {searchOpen ? (
        <View style={searchStyles.searchBar}>
          <TextInput
            ref={inputRef}
            style={searchStyles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('search.placeholder')}
            placeholderTextColor="#7d8590"
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      ) : null}

      {showSearch ? (
        searchSections.length === 0 ? (
          <View style={{ flex: 1 }}>
            <EmptyState title={t('list.noResults')} subtitle={t('list.noResultsSubtitle', { query: debouncedQuery })} />
          </View>
        ) : (
          <SectionList
            sections={searchSections}
            keyExtractor={(item) =>
              'status' in item
                ? `session:${item.serverId}::${item.id}`
                : `conversation:${item.serverId}::${item.id}`
            }
            renderItem={renderSearchItem}
            renderSectionHeader={({ section }) => (
              <View style={searchStyles.sectionHeader}>
                <Text style={searchStyles.sectionHeaderText}>{section.title}</Text>
              </View>
            )}
            contentContainerStyle={searchStyles.listContent}
            stickySectionHeadersEnabled={false}
          />
        )
      ) : (
        <FlatList
          data={flatItems}
          keyExtractor={(item) =>
            item.kind === 'server-root'
              ? `root-${item.serverId}`
              : `row-${item.serverId}-${item.node.fullPath}`
          }
          renderItem={({ item }) => {
            if (item.kind === 'server-root') {
              return (
                <ServerRootRow
                  node={item.node}
                  serverLabel={item.serverLabel}
                  collapsible={item.collapsible}
                  isExpanded={item.isExpanded}
                  onToggle={() => handleToggleServer(item.serverId)}
                  onSelectLeaf={(node) => handleSelectLeaf(node, item.serverId)}
                  isRefreshing={isBackgroundRefreshing}
                />
              )
            }
            return (
              <TreeRow
                node={item.node}
                depth={item.depth}
                depthOffset={item.depthOffset}
                isExpanded={effectiveExpandedPaths.has(item.node.fullPath)}
                onToggle={handleToggle}
                onSelectLeaf={(node) => handleSelectLeaf(node, item.serverId)}
              />
            )
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7d8590"
            />
          }
          contentContainerStyle={flatItems.length === 0 ? { flexGrow: 1 } : styles.listContent}
          ListHeaderComponent={liveSessionsBlock}
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
              router.push(`/conversation/${activeConvItem.id}?server=${activeConvItem.serverId}`)
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
