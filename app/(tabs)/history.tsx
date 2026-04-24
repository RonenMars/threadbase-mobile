import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useDebounce } from 'use-debounce'
import { ConversationList } from '@/components/conversation/ConversationList'
import { useConversations, useConversationSearch } from '@/hooks/useConversations'
import { dark, font, spacing } from '@/constants/theme'
import type { MultiConversation } from '@/types/api'

export default function HistoryScreen() {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery] = useDebounce(searchQuery, 300)
  const [listRefreshEpoch, setListRefreshEpoch] = useState(0)

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

  const listRefreshing = debouncedQuery ? searchResult.isFetching : isFetching

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
        <ConversationList
          conversations={allConversations}
          onRefresh={handleListRefresh}
          refreshing={listRefreshing}
          onEndReached={handleEndReached}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isLoadingInitial={isLoading}
          isFetchingNextPage={isFetchingNextPage}
        />
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
})
