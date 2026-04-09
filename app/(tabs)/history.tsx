import React, { useState, useCallback } from 'react'
import { View, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useDebounce } from 'use-debounce'
import { ConversationList } from '@/components/conversation/ConversationList'
import { useConversations, useConversationSearch } from '@/hooks/useConversations'
import { dark } from '@/constants/theme'
import type { Conversation } from '@/types/api'

export default function HistoryScreen() {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery] = useDebounce(searchQuery, 300)

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useConversations()

  const searchResult = useConversationSearch(debouncedQuery)

  const allConversations: Conversation[] = debouncedQuery
    ? (searchResult.data?.conversations ?? [])
    : (data?.pages.flatMap((p) => p.conversations) ?? [])

  const handleEndReached = useCallback(() => {
    if (!debouncedQuery && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [debouncedQuery, hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ConversationList
        conversations={allConversations}
        onRefresh={refetch}
        refreshing={isRefetching}
        onEndReached={handleEndReached}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark.bg.primary,
  },
})
