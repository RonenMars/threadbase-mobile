import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { LiveDot } from './LiveDot'
import type { SessionStatus } from '@/types/api'
import {
  deriveSessionPresentation,
  type SessionColorToken,
  type SessionPresentationInput,
} from '@/lib/sessionPresentation'

interface Props {
  status: SessionStatus
  isRefetching?: boolean
  /**
   * When true, render the distinct "external — alive" treatment. Prefer
   * passing `session` so kind/label come from `deriveSessionPresentation`.
   */
  externalAlive?: boolean
  /** When set, badge kind/label/color come from the shared presentation helper. */
  session?: SessionPresentationInput
}

function colorForToken(theme: Theme, token: SessionColorToken): string {
  switch (token) {
    case 'running':
      return theme.status.running
    case 'waiting':
      return theme.status.waiting
    case 'completed':
      return theme.status.completed
    case 'failed':
      return theme.status.failed
    case 'idle':
    default:
      return theme.status.idle
  }
}

export function SessionStatusBadge({ status, isRefetching, externalAlive, session }: Props) {
  const theme = useTheme()
  const { t } = useTranslation('sessions')
  const styles = makeStyles(theme)

  const presentation = session
    ? deriveSessionPresentation(session)
    : deriveSessionPresentation({
        status: externalAlive ? 'idle' : status,
        ownership: externalAlive ? 'external' : 'managed',
        processLiveness: externalAlive ? 'alive' : undefined,
        ptyAttached: !externalAlive && (status === 'running' || status === 'waiting_input'),
      })

  const color = colorForToken(theme, presentation.colorToken)
  const label = t(presentation.labelKey)

  return (
    <View style={styles.row} testID={`session-status-${presentation.kind}`}>
      {isRefetching ? (
        <ActivityIndicator size="small" color={color} style={styles.spinner} />
      ) : (
        <LiveDot live={presentation.live} color={color} size={7} />
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
