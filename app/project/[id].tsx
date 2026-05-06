import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useNavigation } from 'expo-router'
import { useDebounce } from 'use-debounce'
import { ConversationList } from '@/components/conversation/ConversationList'
import { useAllProjectChats } from '@/hooks/useProjectChats'
import { useConversationSearch } from '@/hooks/useConversations'
import { dark, font, spacing } from '@/constants/theme'
import type { MultiConversation } from '@/types/api'
import type { ProjectChat } from '@/types/projectChat'

/**
 * Project drill-down keyed by `projectId`. Optional `?path=` and `?server=`
 * query params are display/debug only — never used as primary identity.
 */
export default function ProjectDetailScreen() {
  const { t } = useTranslation('browse')
  const params = useLocalSearchParams<{ id: string; path?: string; server?: string }>()
  const projectId = params.id ?? ''
  const projectPath = params.path ? decodeURIComponent(params.path) : ''
  const projectName = projectPath
    ? projectPath.split('/').filter(Boolean).pop() ?? projectPath
    : projectId

  const navigation = useNavigation()
  useEffect(() => {
    navigation.setOptions({ title: projectName })
  }, [navigation, projectName])

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery] = useDebounce(searchQuery, 300)

  const { items, isFetching, refresh } = useAllProjectChats()
  const searchResult = useConversationSearch(debouncedQuery)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refresh()
    } finally {
      setRefreshing(false)
    }
  }, [refresh])

  // Filter the unified list down to this project.
  const projectItems: ProjectChat[] = useMemo(
    () => items.filter((it) => it.projectId === projectId),
    [items, projectId],
  )

  // ConversationList takes MultiConversation[] for rendering. Map historical
  // ProjectChat conversations into that shape for display only — backend ids
  // remain canonical.
  const projectConversations: MultiConversation[] = useMemo(
    () =>
      projectItems
        .filter((it) => it.type === 'conversation')
        .map((it) => ({
          id: it.id,
          title: it.title,
          projectPath: it.projectPath ?? '',
          messageCount: 0,
          lastActivity: it.latestMessageAt ?? '',
          serverId: it.serverId,
          serverLabel: it.serverLabel,
        })),
    [projectItems],
  )

  const isSearching = debouncedQuery.length > 0
  const isError = !isSearching && searchResult.isError

  const allSearchResults: MultiConversation[] = isSearching
    ? (searchResult.data?.conversations ?? [])
    : projectConversations

  const displayedConversations: MultiConversation[] = isSearching
    ? allSearchResults.filter((c) =>
        projectItems.some((p) => p.type === 'conversation' && p.id === c.id),
      )
    : projectConversations

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {isError ? (
        <ScrollView
          contentContainerStyle={styles.centered}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={handleRefresh}
              tintColor={dark.text.secondary}
            />
          }
        >
          <Text style={styles.errorText}>{t('error.loadFailed')}</Text>
          <Text style={styles.errorHint}>{t('error.retryHint')}</Text>
        </ScrollView>
      ) : (
        <View style={styles.listWrapper}>
          <ConversationList
            conversations={displayedConversations}
            onRefresh={handleRefresh}
            refreshing={refreshing || isFetching}
            onEndReached={() => {}}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isLoadingInitial={false}
            isFetchingNextPage={false}
            loadingProgress={null}
          />
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark.bg.primary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  errorText: {
    color: dark.text.primary,
    fontSize: font.base,
    fontWeight: '600',
  },
  errorHint: {
    color: dark.text.secondary,
    fontSize: font.sm,
    marginTop: spacing.sm,
    opacity: 0.6,
  },
  listWrapper: {
    flex: 1,
    position: 'relative',
  },
})
