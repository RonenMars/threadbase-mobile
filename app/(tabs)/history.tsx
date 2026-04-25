import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useDebounce } from 'use-debounce'
import { ConversationList } from '@/components/conversation/ConversationList'
import { ServerFilterSheet } from '@/components/servers/ServerFilterSheet'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { useConversations, useConversationSearch } from '@/hooks/useConversations'
import { useFocusRefetch } from '@/hooks/useFocusRefetch'
import { useServersStore } from '@/stores/servers'
import { dark, font, spacing } from '@/constants/theme'
import type { MultiConversation } from '@/types/api'

export default function HistoryScreen() {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery] = useDebounce(searchQuery, 300)
  const [listRefreshEpoch, setListRefreshEpoch] = useState(0)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isFetching,
    isLoading,
    isError,
    error,
  } = useConversations(undefined, listRefreshEpoch)

  const searchResult = useConversationSearch(debouncedQuery)

  const allConversations: MultiConversation[] = debouncedQuery
    ? (searchResult.data?.conversations ?? [])
    : (data?.pages.flatMap((p) => p.conversations) ?? [])

  const handleEndReached = useCallback(() => {
    if (!debouncedQuery && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [debouncedQuery, hasNextPage, isFetchingNextPage, fetchNextPage])

  const handleListRefresh = useCallback(() => {
    if (debouncedQuery) {
      void searchResult.refetch()
    } else {
      setListRefreshEpoch((e) => e + 1)
    }
  }, [debouncedQuery, searchResult])

  const focusRefetch = useCallback(async () => {
    if (debouncedQuery) {
      await searchResult.refetch()
    } else {
      await refetch()
    }
  }, [debouncedQuery, refetch, searchResult])
  const isFocusFetching = useFocusRefetch(focusRefetch)

  const listRefreshing = debouncedQuery ? searchResult.isFetching : isFetching
  const isReloading = isLoading || isFocusFetching
  const listEmpty = allConversations.length === 0
  const showOverlay = isReloading && listEmpty
  const showInlineSpinner = isFocusFetching && !listEmpty

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {isError ? (
        <ScrollView
          contentContainerStyle={styles.centered}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={refetch}
              tintColor={dark.text.secondary}
            />
          }
        >
          <Text style={styles.errorText}>Failed to load conversations</Text>
          <Text style={styles.errorDetail}>{String(error)}</Text>
          <Text style={styles.errorHint}>Pull down to retry</Text>
        </ScrollView>
      ) : (
        <View style={styles.listWrapper}>
          <ConversationList
            conversations={allConversations}
            onRefresh={handleListRefresh}
            refreshing={listRefreshing}
            onEndReached={handleEndReached}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isLoadingInitial={false}
            isFetchingNextPage={isFetchingNextPage}
            headerRight={
              <View style={styles.headerRight}>
                {showInlineSpinner ? (
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
          <LoadingOverlay visible={showOverlay} />
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
  errorDetail: {
    color: dark.text.secondary,
    fontSize: font.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
})
