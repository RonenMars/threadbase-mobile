import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { FlatList, View, Text, TextInput, SectionList, RefreshControl, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useDebounce } from 'use-debounce'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useProjectGroups } from './useProjectGroups'
import { useServerGroups } from './useServerGroups'
import { ServerHeaderRow } from '@/components/sessions/tree/ServerHeaderRow'
import { useServersStore } from '@/stores/servers'
import { ProjectHubCard } from './ProjectHubCard'
import { EmptyState } from '../../ui/EmptyState'
import { ConversationListItem } from '@/components/sessions/shared/ConversationListItem'
import { useTheme } from '@/contexts/ThemeContext'
import { XCircle } from 'phosphor-react-native'
import { isMultiSession } from './types'
import { makeStyles } from './ProjectHubList.styles'
import type { ProjectHubListProps, SearchSection } from './types'
import type { ProjectGroup } from './useProjectGroups'
import type { MultiSession, MultiConversation } from '@/types/api'
import { QuickAccessActionSheet } from '@/components/quick-access/QuickAccessActionSheet'
import { useQuickAccessStore, buildFavoriteId } from '@/stores/quickAccess'

export function ProjectHubList({
  sessions,
  conversations,
  sortBy,
  sortOrder,
  refreshing,
  onRefresh,
  searchOpen,
}: ProjectHubListProps) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const styles = makeStyles(theme, insets.bottom)
  const router = useRouter()
  const { t } = useTranslation('sessions')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery] = useDebounce(searchQuery, 300)
  // Tracks which groups are expanded, keyed by projectId (with projectPath
  // fallback during migration — see useProjectGroups).
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const inputRef = useRef<TextInput>(null)
  const [activeConvItem, setActiveConvItem] = useState<MultiConversation | null>(null)
  const { favorites, pinItem, unpinItem } = useQuickAccessStore()

  const groups = useProjectGroups(sessions, conversations, sortBy, sortOrder)

  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const servers = useServersStore((s) => s.servers)
  const serverLabels = useMemo(
    () => Object.fromEntries(activeServerIds.map((id) => [id, servers[id]?.label ?? id])),
    [activeServerIds, servers],
  )
  const serverGroups = useServerGroups(groups, activeServerIds, serverLabels)
  const showServerHeaders = serverGroups.length > 0
  const [collapsedServers, setCollapsedServers] = useState<Set<string>>(new Set())
  const toggleServer = useCallback((serverId: string) => {
    setCollapsedServers((prev) => {
      const next = new Set(prev)
      if (next.has(serverId)) next.delete(serverId)
      else next.add(serverId)
      return next
    })
  }, [])

  useEffect(() => {
    if (!searchOpen) queueMicrotask(() => setSearchQuery(''))
  }, [searchOpen])

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
      router.push(`/conversation/${item.id}?server=${item.serverId}`)
    },
    [router],
  )

  const handleSessionPress = useCallback(
    (item: MultiSession) => {
      router.push(`/session/${item.id}?server=${item.serverId}`)
    },
    [router],
  )

  const searchSections: SearchSection[] = React.useMemo(() => {
    if (!debouncedQuery) return []
    const q = debouncedQuery.toLowerCase()

    const matchedConversations = conversations.filter((c) =>
      c.title?.toLowerCase().includes(q) ||
      c.preview?.toLowerCase().includes(q) ||
      c.firstMessage?.text?.toLowerCase().includes(q) ||
      c.lastMessage?.text?.toLowerCase().includes(q),
    )

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
  }, [debouncedQuery, conversations, sessions])

  const activeServerCount = activeServerIds.length

  const renderSearchResultItem = useCallback(
    ({ item }: { item: MultiConversation | MultiSession }) => {
      const isSession = isMultiSession(item)
      const serverColor = item.serverId ? servers[item.serverId]?.color : undefined
      if (isSession) {
        const isLive = item.status === 'running' || item.status === 'waiting_input'
        return (
          <ConversationListItem
            testID={`session-row-${item.id}`}
            title={item.projectName}
            path={item.projectPath}
            timestamp={item.completedAt ?? item.startedAt}
            branch={item.branch}
            messageCount={item.promptCount}
            live={isLive}
            lastOutput={item.lastOutput || null}
            serverLabel={item.serverLabel}
            serverColor={serverColor}
            activeServerCount={activeServerCount}
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
          title={item.title}
          path={item.projectPath}
          timestamp={item.lastMessage?.timestamp ?? item.lastActivity}
          messageCount={item.messageCount}
          branch={item.branch}
          firstMessage={item.firstMessage}
          lastMessage={item.lastMessage}
          preview={item.preview}
          serverLabel={item.serverLabel}
          serverColor={serverColor}
          activeServerCount={activeServerCount}
          density="comfortable"
          leading="avatar"
          highlight={debouncedQuery}
          provider={item.provider}
          onPress={() => handleConversationPress(item)}
          onLongPress={() => setActiveConvItem(item)}
        />
      )
    },
    [handleConversationPress, handleSessionPress, servers, activeServerCount, debouncedQuery],
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

  const hubFlatData = useMemo((): HubFlatItem[] =>
    showServerHeaders
      ? serverGroups.flatMap((sg) => {
          const expanded = !collapsedServers.has(sg.serverId)
          return [
            { kind: 'header' as const, serverId: sg.serverId, serverLabel: sg.serverLabel, totalCount: sg.totalCount },
            ...(expanded ? sg.groups.map((g) => ({ kind: 'group' as const, group: g })) : []),
          ]
        })
      : groups.map((g) => ({ kind: 'group' as const, group: g })),
    [showServerHeaders, serverGroups, groups, collapsedServers],
  )

  return (
    <View style={styles.container}>
      {searchOpen ? (
        <View style={styles.searchBar}>
          <View style={styles.searchRow}>
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('search.placeholder')}
              placeholderTextColor={theme.text.secondary}
              autoFocus
              returnKeyType="search"
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn} hitSlop={8}>
                <XCircle size={20} color={theme.text.primary} weight="fill" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}

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
            keyExtractor={(item) =>
              isMultiSession(item)
                ? `session:${item.serverId}::${item.id}`
                : `conversation:${item.serverId}::${item.id}`
            }
            renderItem={renderSearchResultItem}
            renderSectionHeader={renderSectionHeader}
            contentContainerStyle={styles.listContent}
            stickySectionHeadersEnabled={false}
          />
        )
      ) : (
        <FlatList
          data={hubFlatData}
          keyExtractor={(item) =>
            item.kind === 'header' ? `header-${item.serverId}` : `project:${item.group.projectId}`
          }
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return (
                <ServerHeaderRow
                  serverId={item.serverId}
                  serverLabel={item.serverLabel}
                  totalCount={item.totalCount}
                  collapsible={serverGroups.length > 1}
                  isExpanded={!collapsedServers.has(item.serverId)}
                  onToggle={() => toggleServer(item.serverId)}
                />
              )
            }
            return (
              <ProjectHubCard
                group={item.group}
                isOpen={openIds.has(item.group.projectId)}
                onToggle={() => toggleOpen(item.group.projectId)}
              />
            )
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text.secondary} />
          }
          contentContainerStyle={hubFlatData.length === 0 ? styles.emptyListContent : styles.listContent}
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
