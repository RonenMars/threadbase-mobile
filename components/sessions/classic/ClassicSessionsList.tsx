import { useState, useEffect, useRef, useMemo } from 'react'
import { View, TextInput, FlatList, RefreshControl } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useDebounce } from 'use-debounce'
import { SessionCard } from '@/components/sessions/SessionCard'
import { LiveSessionsHeader } from '@/components/sessions/LiveSessionsHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { useTheme } from '@/contexts/ThemeContext'
import { styles } from './ClassicSessionsList.styles'
import { makeStyles as makeSearchStyles } from '../SearchStyles'
import type { MultiSession, SessionStatus } from '@/types/api'

interface Props {
  sessions: MultiSession[]
  refreshing: boolean
  onRefresh: () => void
  searchOpen?: boolean
}

const LIVE_STATUSES: SessionStatus[] = ['running', 'waiting_input']

const SESSIONS_COLLAPSE_THRESHOLD = 3

type Row =
  | { kind: 'liveHeader'; id: string; count: number; hasLive: boolean; collapsed: boolean; collapsible: boolean }
  | { kind: 'session'; session: MultiSession }

export function ClassicSessionsList({ sessions, refreshing, onRefresh, searchOpen }: Props) {
  const theme = useTheme()
  const searchStyles = makeSearchStyles(theme)
  const { t } = useTranslation('sessions')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery] = useDebounce(searchQuery, 300)
  const inputRef = useRef<TextInput>(null)
  const [sessionsCollapsed, setSessionsCollapsed] = useState(
    () => sessions.length > SESSIONS_COLLAPSE_THRESHOLD
  )

  useEffect(() => {
    if (!searchOpen) queueMicrotask(() => setSearchQuery(''))
  }, [searchOpen])

  const filteredSessions = useMemo(() => {
    if (!debouncedQuery) return sessions
    const q = debouncedQuery.toLowerCase()
    return sessions.filter(
      (s) => s.projectName?.toLowerCase().includes(q) || s.lastOutput?.toLowerCase().includes(q),
    )
  }, [debouncedQuery, sessions])

  const rows = useMemo<Row[]>(() => {
    if (filteredSessions.length === 0) return []
    const live = filteredSessions.filter((s) => LIVE_STATUSES.includes(s.status))
    const idle = filteredSessions.filter((s) => !LIVE_STATUSES.includes(s.status))
    const collapsible = filteredSessions.length > SESSIONS_COLLAPSE_THRESHOLD
    const header: Row = { kind: 'liveHeader', id: 'live-header', count: filteredSessions.length, hasLive: live.length > 0, collapsed: sessionsCollapsed, collapsible }
    if (collapsible && sessionsCollapsed) return [header]
    return [
      header,
      ...live.map((s) => ({ kind: 'session' as const, session: s })),
      ...idle.map((s) => ({ kind: 'session' as const, session: s })),
    ]
  }, [filteredSessions, sessionsCollapsed])

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
            placeholderTextColor={theme.text.secondary}
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      ) : null}
      <FlatList
        data={rows}
        keyExtractor={(item) =>
          item.kind === 'liveHeader' ? item.id : `${item.session.serverId}::${item.session.id}`
        }
        renderItem={({ item }) =>
          item.kind === 'liveHeader' ? (
            <LiveSessionsHeader
              count={item.count}
              hasLive={item.hasLive}
              collapsed={item.collapsed}
              onToggle={item.collapsible ? () => setSessionsCollapsed((v) => !v) : undefined}
            />
          ) : (
            <SessionCard session={item.session} />
          )
        }
        contentContainerStyle={rows.length === 0 ? styles.emptyContent : styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text.secondary} />
        }
        ListEmptyComponent={
          <View style={{ flex: 1 }}>
            {debouncedQuery ? (
              <EmptyState title={t('list.noResults')} subtitle={t('list.noResultsSubtitle', { query: debouncedQuery })} />
            ) : (
              <EmptyState title={t('list.empty')} subtitle={t('list.emptySubtitle')} />
            )}
          </View>
        }
      />
    </View>
  )
}
