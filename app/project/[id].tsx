import React, { useState, useCallback, useEffect } from 'react'
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
import { useProjectConversations } from '@/hooks/useProjectConversations'
import { useConversationSearch } from '@/hooks/useConversations'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import type { MultiConversation } from '@/types/api'
import { useServersStore } from '@/stores/servers'

export default function ProjectDetailScreen() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { t } = useTranslation('browse')
  const params = useLocalSearchParams<{ id: string; path?: string; server?: string }>()
  const projectPath = params.path ? decodeURIComponent(params.path) : ''
  const projectName = projectPath
    ? projectPath.split('/').filter(Boolean).pop() ?? projectPath
    : params.id ?? ''

  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const servers = useServersStore((s) => s.servers)
  const serverId = params.server ?? activeServerIds[0] ?? ''
  const serverLabel = servers[serverId]?.label

  const navigation = useNavigation()
  useEffect(() => {
    navigation.setOptions({ title: projectName })
  }, [navigation, projectName])

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery] = useDebounce(searchQuery, 300)

  const { conversations, isFetching, refresh, fetchNextPage, hasNextPage } =
    useProjectConversations(projectPath, serverId, serverLabel)
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

  const isSearching = debouncedQuery.length > 0
  const isError = !isSearching && searchResult.isError

  const displayedConversations: MultiConversation[] = isSearching
    ? (searchResult.data?.conversations ?? [])
        .filter((c) => conversations.some((p) => p.id === c.id))
        .map((c) => ({ ...c, serverId, serverLabel }))
    : conversations

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {isError ? (
        <ScrollView
          contentContainerStyle={styles.centered}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={handleRefresh}
              tintColor={theme.text.secondary}
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
            onEndReached={() => { if (hasNextPage) fetchNextPage() }}
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

function makeStyles(theme: Theme) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg.primary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  errorText: {
    color: theme.text.primary,
    fontSize: font.base,
    fontWeight: '600',
  },
  errorHint: {
    color: theme.text.secondary,
    fontSize: font.sm,
    marginTop: spacing.sm,
    opacity: 0.6,
  },
  listWrapper: {
    flex: 1,
    position: 'relative',
  },
})}

