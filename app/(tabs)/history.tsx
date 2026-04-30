import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useDebounce } from 'use-debounce'
import { ConversationList } from '@/components/conversation/ConversationList'
import { ServerFilterSheet } from '@/components/servers/ServerFilterSheet'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { useEagerConversations, useConversationSearch } from '@/hooks/useConversations'
import { useFocusRefetch } from '@/hooks/useFocusRefetch'
import { useServersStore } from '@/stores/servers'
import { dark, font, spacing } from '@/constants/theme'
import type { MultiConversation } from '@/types/api'

export default function HistoryScreen() {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery] = useDebounce(searchQuery, 300)
  const [refreshEpoch, setRefreshEpoch] = useState(0)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [loaderMode, setLoaderMode] = useState<'full' | 'minimal'>('full')
  const nextLoaderModeRef = useRef<'full' | 'minimal'>('minimal')
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        nextLoaderModeRef.current = 'full'
      }
    })
    return () => sub.remove()
  }, [])

  const { conversations, loaded, total, isDone, isCounting } = useEagerConversations(undefined, refreshEpoch)
  const searchResult = useConversationSearch(debouncedQuery)

  const handleRefresh = useCallback(() => {
    setLoaderMode('full')
    setRefreshEpoch((e) => e + 1)
  }, [])

  useFocusRefetch(useCallback(async () => {
    const mode = nextLoaderModeRef.current
    nextLoaderModeRef.current = 'minimal'
    setLoaderMode(mode)
    setRefreshEpoch((e) => e + 1)
  }, []))

  const isSearching = debouncedQuery.length > 0
  const isError = !isSearching && searchResult.isError
  const showFullProgress = !isSearching && !isDone && loaderMode === 'full'
  const showMinimalLoader = !isSearching && !isDone && loaderMode === 'minimal'

  const displayedConversations: MultiConversation[] = isSearching
    ? (searchResult.data?.conversations ?? [])
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
              tintColor={dark.text.secondary}
            />
          }
        >
          <Text style={styles.errorText}>Failed to load conversations</Text>
          <Text style={styles.errorHint}>Pull down to retry</Text>
        </ScrollView>
      ) : (
        <View style={styles.listWrapper}>
          <ConversationList
            conversations={displayedConversations}
            onRefresh={handleRefresh}
            refreshing={showFullProgress}
            onEndReached={() => {}}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isLoadingInitial={false}
            isFetchingNextPage={false}
            loadingProgress={showFullProgress ? { loaded, total, isCounting } : null}
            headerRight={
              <View style={styles.headerRight}>
                {isSearching && searchResult.isFetching ? (
                  <ActivityIndicator size="small" color={dark.text.secondary} />
                ) : null}
                {activeServerIds.length > 1 ? (
                  <TouchableOpacity
                    style={styles.filterButton}
                    onPress={() => setIsFilterOpen(true)}
                  >
                    <Text style={styles.filterButtonText}>
                      {displayedServerIds.length > 0 ? `${displayedServerIds.length}` : '0'} filter
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            }
          />
          {showMinimalLoader ? (
            <View style={styles.minimalLoaderCorner} pointerEvents="none">
              <ActivityIndicator size="small" color={dark.text.secondary} />
            </View>
          ) : null}
        </View>
      )}
      <ServerFilterSheet visible={isFilterOpen} onClose={() => setIsFilterOpen(false)} />
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
  filterButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingLeft: spacing.sm,
  },
  filterButtonText: {
    color: dark.text.accent,
    fontSize: font.sm,
    fontWeight: '500',
  },
  listWrapper: {
    flex: 1,
    position: 'relative',
  },
  minimalLoaderCorner: {
    position: 'absolute',
    top: spacing.md * 2 + 44,
    right: spacing.md,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
})
