import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { LiveDot } from './LiveDot'
import type { SessionStatus } from '@/types/api'

const STATUS_LABELS: Record<SessionStatus, string> = {
  running: 'Running',
  waiting_input: 'Active',
  idle: 'Idle',
}

interface Props {
  status: SessionStatus
  isRefetching?: boolean
  /**
   * When true, render the distinct "external — alive" treatment (a discovered
   * process the streamer only observes) instead of the status label: a blue
   * pulsing dot + "External". Visually separate from an interactive
   * streamer-owned live session.
   */
  externalAlive?: boolean
}

export function SessionStatusBadge({ status, isRefetching, externalAlive }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const STATUS_COLORS: Record<SessionStatus, string> = {
    running: theme.status.running,
    waiting_input: theme.status.running,
    idle: theme.status.idle,
  }
  const color = externalAlive ? theme.status.completed : (STATUS_COLORS[status] ?? theme.status.idle)
  const isLive = externalAlive || status === 'running' || status === 'waiting_input'
  const label = externalAlive ? 'External' : STATUS_LABELS[status]

  return (
    <View style={styles.row}>
      {isRefetching ? (
        <ActivityIndicator size="small" color={color} style={styles.spinner} />
      ) : (
        <LiveDot live={isLive} color={color} size={7} />
      )}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  )
}

function makeStyles(_theme: Theme) {
  return StyleSheet.create({
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
}
