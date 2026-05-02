import React, { useState, useEffect, useRef, useMemo } from 'react'
import { View, TextInput, FlatList, RefreshControl } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useDebounce } from 'use-debounce'
import { SessionCard } from '@/components/sessions/SessionCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { dark } from '@/constants/theme'
import { styles } from './ClassicSessionsList.styles'
import { searchStyles } from '../SearchStyles'
import type { MultiSession } from '@/types/api'

interface Props {
  sessions: MultiSession[]
  refreshing: boolean
  onRefresh: () => void
  searchOpen?: boolean
}

export function ClassicSessionsList({ sessions, refreshing, onRefresh, searchOpen }: Props) {
  const { t } = useTranslation('sessions')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery] = useDebounce(searchQuery, 300)
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    if (!searchOpen) setSearchQuery('')
  }, [searchOpen])

  const filteredSessions = useMemo(() => {
    if (!debouncedQuery) return sessions
    const q = debouncedQuery.toLowerCase()
    return sessions.filter(
      (s) => s.projectName?.toLowerCase().includes(q) || s.lastOutput?.toLowerCase().includes(q),
    )
  }, [debouncedQuery, sessions])

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
            placeholderTextColor={dark.text.secondary}
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      ) : null}
      <FlatList
        data={filteredSessions}
        keyExtractor={(item) => `${item.serverId}::${item.id}`}
        renderItem={({ item }) => <SessionCard session={item} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={dark.text.secondary} />
        }
        ListEmptyComponent={
          debouncedQuery ? (
            <EmptyState title={t('list.noResults')} subtitle={t('list.noResultsSubtitle', { query: debouncedQuery })} />
          ) : (
            <EmptyState title={t('list.empty')} subtitle={t('list.emptySubtitle')} />
          )
        }
      />
    </View>
  )
}
