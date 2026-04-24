import React, { useState, useEffect, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { KanbanBoard } from '@/components/sessions/KanbanBoard'
import { ServerFilterSheet } from '@/components/servers/ServerFilterSheet'
import { useSessions } from '@/hooks/useSession'
import { useSessionsStore } from '@/stores/sessions'
import { useServersStore } from '@/stores/servers'
import { wsManager } from '@/services/ws-client'
import { dark, font, spacing } from '@/constants/theme'
import type { MultiSession, SessionStatus } from '@/types/api'

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
  const { refetch, isPending: sessionsInitialLoad } = useSessions()
  const sessions = useSessionsStore((s) => s.sessions)
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const [manualRefreshing, setManualRefreshing] = useState(false)
  const [connectedCount, setConnectedCount] = useState(0)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

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

  const handleRefresh = async () => {
    setManualRefreshing(true)
    await refetch()
    setManualRefreshing(false)
  }

  const visibleSessions = useMemo(
    () => sessions.filter((session) => displayedServerIds.includes(session.serverId)),
    [sessions, displayedServerIds],
  )

  const grouped = useMemo(() => {
    const result: Record<SessionStatus, MultiSession[]> = {
      running: [],
      waiting_input: [],
      completed: [],
      failed: [],
      idle: [],
    }
    for (const session of visibleSessions) {
      if (session.source === 'discovered') continue
      result[session.status].push(session)
    }
    return result
  }, [visibleSessions])

  const total = activeServerIds.length
  const allConnected = connectedCount === total && total > 0
  const someConnected = connectedCount > 0
  const statusColor = getStatusColor(allConnected, someConnected)
  const statusLabel = getStatusLabel(total, connectedCount, allConnected)

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.statusBar}>
        {activeServerIds.length > 1 ? (
          <TouchableOpacity style={styles.filterButton} onPress={() => setIsFilterOpen(true)}>
            <Text style={styles.filterButtonText}>Filter servers</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={[styles.wsStatus, { color: statusColor }]}>
          {statusLabel}
        </Text>
      </View>

      <KanbanBoard
        sessionsByStatus={grouped}
        onRefresh={handleRefresh}
        refreshing={manualRefreshing}
        isInitialLoading={sessionsInitialLoad}
      />
      <ServerFilterSheet visible={isFilterOpen} onClose={() => setIsFilterOpen(false)} />
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
})
