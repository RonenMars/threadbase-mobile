import React from 'react'
import {
  View,
  Text,
  ScrollView,
  FlatList,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
} from 'react-native'
import { SessionCard } from './SessionCard'
import { SessionCardSkeleton } from './SessionCardSkeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { dark, font, spacing, TABLET_BREAKPOINT } from '@/constants/theme'
import type { MultiSession, SessionStatus } from '@/types/api'

interface Column {
  status: SessionStatus
  label: string
  icon: string
  emptyTitle: string
  emptySubtitle: string
}

const COLUMNS: Column[] = [
  {
    status: 'running',
    label: 'Running',
    icon: '▶',
    emptyTitle: 'No running sessions',
    emptySubtitle: 'Start a Claude Code session to see it here',
  },
  {
    status: 'waiting_input',
    label: 'Waiting for Input',
    icon: '⏳',
    emptyTitle: 'No sessions waiting',
    emptySubtitle: 'Sessions needing your input will appear here',
  },
  {
    status: 'completed',
    label: 'Completed',
    icon: '✅',
    emptyTitle: 'No completed sessions',
    emptySubtitle: '',
  },
  {
    status: 'failed',
    label: 'Failed',
    icon: '❌',
    emptyTitle: 'No failed sessions',
    emptySubtitle: '',
  },
]

const SESSION_SKELETON_KEYS = ['s0', 's1', 's2', 's3'] as const

interface KanbanColumnProps {
  column: Column
  sessions: MultiSession[]
  onRefresh: () => void
  refreshing: boolean
  isTablet: boolean
  isInitialLoading: boolean
}

function KanbanColumn({
  column,
  sessions,
  onRefresh,
  refreshing,
  isTablet,
  isInitialLoading,
}: KanbanColumnProps) {
  const showSkeletons = isInitialLoading
  const listData: (MultiSession | string)[] = showSkeletons ? [...SESSION_SKELETON_KEYS] : sessions

  return (
    <View style={[styles.column, isTablet && styles.columnTablet]}>
      <View style={styles.columnHeader}>
        <Text style={styles.columnIcon}>{column.icon}</Text>
        <Text style={styles.columnLabel}>{column.label}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{showSkeletons ? '—' : sessions.length}</Text>
        </View>
      </View>
      <FlatList<MultiSession | string>
        data={listData}
        keyExtractor={(item) =>
          typeof item === 'string' ? `sk-${column.status}-${item}` : item.id
        }
        renderItem={({ item }) =>
          typeof item === 'string' ? <SessionCardSkeleton /> : <SessionCard session={item} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={dark.text.secondary}
          />
        }
        ListEmptyComponent={
          showSkeletons ? null : (
            <EmptyState
              title={column.emptyTitle}
              subtitle={column.emptySubtitle}
            />
          )
        }
      />
    </View>
  )
}

interface KanbanBoardProps {
  sessionsByStatus: Record<SessionStatus, MultiSession[]>
  onRefresh: () => void
  refreshing: boolean
  /** First fetch after mount — show column skeletons instead of empty states. */
  isInitialLoading?: boolean
}

export function KanbanBoard({
  sessionsByStatus,
  onRefresh,
  refreshing,
  isInitialLoading = false,
}: KanbanBoardProps) {
  const { width } = useWindowDimensions()
  const isTablet = width >= TABLET_BREAKPOINT

  if (isTablet) {
    return (
      <View style={styles.tabletRow}>
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.status}
            column={col}
            sessions={sessionsByStatus[col.status]}
            onRefresh={onRefresh}
            refreshing={refreshing}
            isTablet
            isInitialLoading={isInitialLoading}
          />
        ))}
      </View>
    )
  }

  return (
    <ScrollView
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      style={styles.scrollView}
    >
      {COLUMNS.map((col) => (
        <View key={col.status} style={[styles.phoneColumn, { width }]}>
          <KanbanColumn
            column={col}
            sessions={sessionsByStatus[col.status]}
            onRefresh={onRefresh}
            refreshing={refreshing}
            isTablet={false}
            isInitialLoading={isInitialLoading}
          />
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  tabletRow: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  phoneColumn: {
    flex: 1,
  },
  column: {
    flex: 1,
  },
  columnTablet: {
    flex: 1,
    minWidth: 0,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    position: 'relative',
  },
  columnIcon: {
    fontSize: font.sm,
  },
  columnLabel: {
    color: dark.text.primary,
    fontSize: font.sm,
    fontWeight: '600',
    flex: 1,
  },
  countBadge: {
    backgroundColor: dark.bg.card,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    color: dark.text.secondary,
    fontSize: font.xs,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.sm,
    flexGrow: 1,
  },
})
