import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SessionCard } from '@/components/sessions/SessionCard'
import { ServerFilterSheet, type SortType } from '@/components/servers/ServerFilterSheet'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { EmptyState } from '@/components/ui/EmptyState'
import { useSessions } from '@/hooks/useSession'
import { useFocusRefetch } from '@/hooks/useFocusRefetch'
import { useServersStore } from '@/stores/servers'
import { wsManager } from '@/services/ws-client'
import { dark, font, spacing } from '@/constants/theme'
import type { MultiSession, SessionStatus } from '@/types/api'

const ALL_STATUSES: SessionStatus[] = ['running', 'waiting_input', 'completed', 'failed', 'idle']

// For "lastActivity" sort: prefer completedAt; otherwise approximate "still
// active until" with startedAt + elapsedMs so a long-running session beats
// an older session that completed quickly.
function lastActivityMs(s: MultiSession): number {
  if (s.completedAt) return Date.parse(s.completedAt)
  return Date.parse(s.startedAt) + (s.elapsedMs ?? 0)
}

function getStatusColor(allConnected: boolean, someConnected: boolean): string {
  if (allConnected) return dark.status.running
  if (someConnected) return dark.status.waiting
  return dark.status.failed
}

function getStatusLabel(total: number, connectedCount: number, allConnected: boolean): string {
  if (total === 0) return '○ No servers'
  if (total === 1) return allConnected ? '● Live' : '○ Offline'
  return `${connectedCount}/${total} connected`
}

export default function SessionsScreen() {
  const { data: sessions = [], refetch, isPending } = useSessions()
  const hasLoadedOnce = useRef(false)
  if (!isPending) hasLoadedOnce.current = true
  const listRef = useRef<FlatList<MultiSession>>(null)
  const hasScrolledToBottom = useRef(false)
  const sessionsInitialLoad = isPending && !hasLoadedOnce.current
  const isFocusFetching = useFocusRefetch(refetch)
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const [manualRefreshing, setManualRefreshing] = useState(false)
  const [connectedCount, setConnectedCount] = useState(0)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [selectedStatuses, setSelectedStatuses] = useState<SessionStatus[]>(ALL_STATUSES)
  const [sortType, setSortType] = useState<SortType>('lastActivity')

  useEffect(() => {
    const updateCount = () => {
      let count = 0
      for (const id of activeServerIds) {
        if (wsManager.status(id) === 'connected') count++
      }
      setConnectedCount(count)
    }
    updateCount()
    const unsub = wsManager.onAnyStatusChange(() => updateCount())
    return unsub
  }, [activeServerIds])

  useEffect(() => {
    if (visibleSessions.length > 0 && !hasScrolledToBottom.current) {
      hasScrolledToBottom.current = true
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100)
    }
  }, [visibleSessions.length])

  const handleRefresh = async () => {
    setManualRefreshing(true)
    await refetch()
    setManualRefreshing(false)
  }

  const visibleSessions = useMemo(() => {
    const filtered = sessions.filter(
      (session) =>
        session.source !== 'discovered' &&
        displayedServerIds.includes(session.serverId) &&
        selectedStatuses.includes(session.status),
    )
    if (sortType === 'lastActivity') {
      return filtered.sort((a, b) => lastActivityMs(b) - lastActivityMs(a))
    }
    return filtered.sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))
  }, [sessions, displayedServerIds, selectedStatuses, sortType])

  const total = activeServerIds.length
  const allConnected = connectedCount === total && total > 0
  const someConnected = connectedCount > 0
  const statusColor = getStatusColor(allConnected, someConnected)
  const statusLabel = getStatusLabel(total, connectedCount, allConnected)

  const isReloading = sessionsInitialLoad || isFocusFetching
  const listEmpty = visibleSessions.length === 0
  const showOverlay = isReloading && listEmpty
  const showInlineSpinner = isReloading && !listEmpty
  const isFiltered =
    selectedStatuses.length < ALL_STATUSES.length ||
    (activeServerIds.length > 1 && displayedServerIds.length < activeServerIds.length)

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.statusBar}>
        <TouchableOpacity style={styles.filterButton} onPress={() => setIsFilterOpen(true)}>
          <Text style={styles.filterButtonText}>{isFiltered ? 'Filters ●' : 'Filters'}</Text>
        </TouchableOpacity>
        <View style={styles.statusRight}>
          {showInlineSpinner ? (
            <ActivityIndicator size="small" color={dark.text.secondary} />
          ) : null}
          <Text style={[styles.wsStatus, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.listWrapper}>
        <FlatList<MultiSession>
          ref={listRef}
          data={visibleSessions}
          keyExtractor={(item) => `${item.serverId}::${item.id}`}
          renderItem={({ item }) => <SessionCard session={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={manualRefreshing}
              onRefresh={handleRefresh}
              tintColor={dark.text.secondary}
            />
          }
          ListEmptyComponent={
            showOverlay ? null : (
              <EmptyState
                title={isFiltered ? 'No matching sessions' : 'No sessions'}
                subtitle={
                  isFiltered
                    ? 'Try adjusting your filters'
                    : 'Start a Claude Code session to see it here'
                }
              />
            )
          }
        />
        <LoadingOverlay visible={showOverlay} />
      </View>
      <ServerFilterSheet
        visible={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        selectedStatuses={selectedStatuses}
        onChangeStatuses={setSelectedStatuses}
        sortType={sortType}
        onChangeSortType={setSortType}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark.bg.primary,
  },
  statusBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  filterButton: {
    minHeight: 36,
    justifyContent: 'center',
  },
  filterButtonText: {
    color: dark.text.accent,
    fontSize: font.sm,
    fontWeight: '500',
  },
  wsStatus: {
    fontSize: font.xs,
    fontWeight: '500',
  },
  listWrapper: {
    flex: 1,
    position: 'relative',
  },
  listContent: {
    padding: spacing.sm,
    flexGrow: 1,
  },
})
