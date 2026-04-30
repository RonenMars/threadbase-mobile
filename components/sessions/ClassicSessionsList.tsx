import React from 'react'
import { FlatList, RefreshControl, StyleSheet } from 'react-native'
import { SessionCard } from '@/components/sessions/SessionCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { dark, spacing } from '@/constants/theme'
import type { MultiSession } from '@/types/api'

interface Props {
  sessions: MultiSession[]
  refreshing: boolean
  onRefresh: () => void
}

export function ClassicSessionsList({ sessions, refreshing, onRefresh }: Props) {
  return (
    <FlatList
      data={sessions}
      keyExtractor={(item) => `${item.serverId}::${item.id}`}
      renderItem={({ item }) => <SessionCard session={item} />}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={dark.text.secondary}
        />
      }
      ListEmptyComponent={
        <EmptyState title="No sessions" subtitle="Start a Claude Code session to see it here" />
      }
    />
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.sm, flexGrow: 1 },
})
