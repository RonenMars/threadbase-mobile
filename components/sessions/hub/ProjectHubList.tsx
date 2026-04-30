import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  FlatList,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SectionList,
  RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useDebounce } from 'use-debounce'
import type { MultiSession, MultiConversation } from '../../../types/api'
import type { SortBy, SortOrder } from '../../../types/ui'
import { useProjectGroups, type ProjectGroup } from './useProjectGroups'
import { ProjectHubCard } from './ProjectHubCard'
import { EmptyState } from '../../ui/EmptyState'
import { dark, font, spacing } from '@/constants/theme'

interface Props {
  sessions: MultiSession[]
  conversations: MultiConversation[]
  sortBy: SortBy
  sortOrder: SortOrder
  refreshing: boolean
  onRefresh: () => void
  searchOpen: boolean
}

type SearchSection = {
  title: string
  data: (MultiConversation | MultiSession)[]
  kind: 'conversation' | 'session'
}

function isMultiSession(item: MultiConversation | MultiSession): item is MultiSession {
  return 'status' in item
}

export function ProjectHubList({
  sessions,
  conversations,
  sortBy,
  sortOrder,
  refreshing,
  onRefresh,
  searchOpen,
}: Props) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery] = useDebounce(searchQuery, 300)
  const [openPaths, setOpenPaths] = useState<Set<string>>(new Set())
  const inputRef = useRef<TextInput>(null)

  const groups = useProjectGroups(sessions, conversations, sortBy, sortOrder)

  useEffect(() => {
    if (!searchOpen) {
      setSearchQuery('')
    }
  }, [searchOpen])

  const toggleOpen = useCallback((projectPath: string) => {
    setOpenPaths((prev) => {
      const next = new Set(prev)
      if (next.has(projectPath)) {
        next.delete(projectPath)
      } else {
        next.add(projectPath)
      }
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
      if (item.source === 'discovered' && item.conversationId) {
        router.push(`/conversation/${item.conversationId}?server=${item.serverId}`)
      } else {
        router.push(`/session/${item.id}?server=${item.serverId}`)
      }
    },
    [router],
  )

  // Build search sections when there's a debounced query
  const searchSections: SearchSection[] = React.useMemo(() => {
    if (!debouncedQuery) return []
    const q = debouncedQuery.toLowerCase()

    const matchedConversations = conversations.filter((c) => {
      return (
        c.title?.toLowerCase().includes(q) ||
        c.preview?.toLowerCase().includes(q) ||
        c.firstMessage?.text?.toLowerCase().includes(q) ||
        c.lastMessage?.text?.toLowerCase().includes(q)
      )
    })

    const matchedSessions = sessions.filter((s) => {
      return (
        s.projectName?.toLowerCase().includes(q) ||
        s.lastOutput?.toLowerCase().includes(q)
      )
    })

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

  const renderSearchResultItem = useCallback(
    ({ item }: { item: MultiConversation | MultiSession }) => {
      if (isMultiSession(item)) {
        const lastSegment = item.projectPath?.split('/').filter(Boolean).pop() ?? ''
        return (
          <TouchableOpacity
            style={styles.resultRow}
            onPress={() => handleSessionPress(item)}
            activeOpacity={0.7}
          >
            <Text style={styles.resultTitle} numberOfLines={1}>
              {item.projectName}
            </Text>
            {lastSegment ? (
              <Text style={styles.resultSubtitle} numberOfLines={1}>
                {lastSegment}
              </Text>
            ) : null}
          </TouchableOpacity>
        )
      }

      const lastSegment = item.projectPath?.split('/').filter(Boolean).pop() ?? ''
      return (
        <TouchableOpacity
          style={styles.resultRow}
          onPress={() => handleConversationPress(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.resultTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {lastSegment ? (
            <Text style={styles.resultSubtitle} numberOfLines={1}>
              {lastSegment}
            </Text>
          ) : null}
        </TouchableOpacity>
      )
    },
    [handleConversationPress, handleSessionPress],
  )

  const renderSectionHeader = useCallback(
    ({ section }: { section: SearchSection }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{section.title}</Text>
      </View>
    ),
    [],
  )

  const renderGroup = useCallback(
    ({ item }: { item: ProjectGroup }) => (
      <ProjectHubCard
        group={item}
        isOpen={openPaths.has(item.projectPath)}
        onToggle={() => toggleOpen(item.projectPath)}
      />
    ),
    [openPaths, toggleOpen],
  )

  const showSearch = searchOpen && debouncedQuery.length > 0

  return (
    <View style={styles.container}>
      {searchOpen ? (
        <View style={styles.searchBar}>
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search sessions & conversations…"
            placeholderTextColor={dark.text.secondary}
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      ) : null}

      {showSearch ? (
        searchSections.length === 0 ? (
          <EmptyState title="No results" subtitle={`Nothing matched "${debouncedQuery}"`} />
        ) : (
          <SectionList
            sections={searchSections}
            keyExtractor={(item) => (isMultiSession(item) ? `s-${item.id}` : `c-${item.id}`)}
            renderItem={renderSearchResultItem}
            renderSectionHeader={renderSectionHeader}
            contentContainerStyle={styles.listContent}
            stickySectionHeadersEnabled={false}
          />
        )
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.projectPath}
          renderItem={renderGroup}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={dark.text.secondary}
            />
          }
          contentContainerStyle={
            groups.length === 0 ? styles.emptyListContent : styles.listContent
          }
          ListEmptyComponent={
            <EmptyState
              title="No projects yet"
              subtitle="Sessions and conversations will appear here"
            />
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: dark.border,
  },
  searchInput: {
    backgroundColor: dark.bg.card,
    color: dark.text.primary,
    fontSize: font.base,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: dark.border,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  sectionHeaderText: {
    color: dark.text.secondary,
    fontSize: font.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.border,
  },
  resultTitle: {
    color: dark.text.primary,
    fontSize: font.base,
  },
  resultSubtitle: {
    color: dark.text.secondary,
    fontSize: font.sm,
    marginTop: 2,
  },
})
