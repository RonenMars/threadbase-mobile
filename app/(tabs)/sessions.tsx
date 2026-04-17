import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { KanbanBoard } from '@/components/sessions/KanbanBoard'
import { useSessions } from '@/hooks/useSession'
import { useSessionsStore } from '@/stores/sessions'
import { useServersStore } from '@/stores/servers'
import { wsManager } from '@/services/ws-client'
import { dark, font, spacing } from '@/constants/theme'

export default function SessionsScreen() {
  const { refetch } = useSessions()
  const sessionsByStatus = useSessionsStore((s) => s.sessionsByStatus)
  const servers = useServersStore((s) => s.servers)
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const [manualRefreshing, setManualRefreshing] = useState(false)
  const [connectedCount, setConnectedCount] = useState(0)

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

  const total = activeServerIds.length
  const allConnected = connectedCount === total && total > 0
  const someConnected = connectedCount > 0
  const statusColor = allConnected
    ? dark.status.running
    : someConnected
      ? dark.status.waiting
      : dark.status.failed
  const statusLabel = total === 0
    ? '○ No servers'
    : total === 1
      ? allConnected ? '● Live' : '○ Offline'
      : `${connectedCount}/${total} connected`

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.statusBar}>
        <Text style={[styles.wsStatus, { color: statusColor }]}>
          {statusLabel}
        </Text>
      </View>

      <KanbanBoard
        sessionsByStatus={sessionsByStatus()}
        onRefresh={handleRefresh}
        refreshing={manualRefreshing}
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
    alignItems: 'flex-end',
  },
  wsStatus: {
    fontSize: font.xs,
    fontWeight: '500',
  },
})
