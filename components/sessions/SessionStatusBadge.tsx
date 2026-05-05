import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { dark, font, spacing } from '@/constants/theme'
import { LiveDot } from './LiveDot'
import type { SessionStatus } from '@/types/api'

const STATUS_LABELS: Record<SessionStatus, string> = {
  running: 'Running',
  waiting_input: 'Active',
  idle: 'Idle',
}

const STATUS_COLORS: Record<SessionStatus, string> = {
  running: dark.status.running,
  waiting_input: dark.status.running,
  idle: dark.status.idle,
}

interface Props {
  status: SessionStatus
  isRefetching?: boolean
}

export function SessionStatusBadge({ status, isRefetching }: Props) {
  const color = STATUS_COLORS[status] ?? dark.status.idle
  const isLive = status === 'running' || status === 'waiting_input'

  return (
    <View style={styles.row}>
      {isRefetching ? (
        <ActivityIndicator size="small" color={color} style={styles.spinner} />
      ) : (
        <LiveDot live={isLive} color={color} size={7} />
      )}
      <Text style={[styles.label, { color }]}>{STATUS_LABELS[status]}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  spinner: {
    transform: [{ scale: 0.6 }],
  },
  label: {
    fontSize: font.xs,
    fontWeight: '500',
  },
})
