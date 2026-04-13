import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { KanbanBoard } from '@/components/sessions/KanbanBoard'
import { useSessions } from '@/hooks/useSession'
import { useSessionsStore } from '@/stores/sessions'
import { wsClient } from '@/services/ws-client'
import { dark, font, radius, spacing } from '@/constants/theme'

type WsStatus = 'connecting' | 'connected' | 'disconnected'

const WS_STATUS_COLORS: Record<WsStatus, string> = {
  connected: dark.status.running,
  connecting: dark.status.waiting,
  disconnected: dark.status.failed,
}

const WS_STATUS_LABELS: Record<WsStatus, string> = {
  connected: '● Live',
  connecting: '◌ Reconnecting',
  disconnected: '○ Offline',
}

export default function SessionsScreen() {
  const { refetch } = useSessions()
  const sessionsByStatus = useSessionsStore((s) => s.sessionsByStatus)
  const [wsStatus, setWsStatus] = useState<WsStatus>(wsClient.status())
  const [manualRefreshing, setManualRefreshing] = useState(false)

  useEffect(() => {
    return wsClient.onStatusChange((s) => setWsStatus(s))
  }, [])

  const handleRefresh = async () => {
    setManualRefreshing(true)
    await refetch()
    setManualRefreshing(false)
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.statusBar}>
        <Text style={[styles.wsStatus, { color: WS_STATUS_COLORS[wsStatus] }]}>
          {WS_STATUS_LABELS[wsStatus]}
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
