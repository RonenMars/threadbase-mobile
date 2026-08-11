import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { LiveDot } from './LiveDot'
import {
  deriveSessionPresentation,
  type SessionColorToken,
  type SessionPresentationInput,
} from '@/lib/sessionPresentation'
import { agentSubStatusLabelKey, type AgentSubStatus } from '@/lib/agentSubStatus'

interface Props {
  /** Kind, label and colour all come from the shared presentation helper. */
  session: SessionPresentationInput
  isRefetching?: boolean
  /**
   * Screen-derived refinement of a `running` status ("Thinking" / "Writing"
   * rather than the undifferentiated "Running"). Label only — kind, colour and
   * the `session-status-*` testID stay put, so nothing keyed off this badge
   * changes behaviour when the scrape misses.
   */
  subStatus?: AgentSubStatus
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

export function SessionStatusBadge({ session, isRefetching, subStatus }: Props) {
  const theme = useTheme()
  const { t } = useTranslation('sessions')
  const styles = makeStyles(theme)

  const presentation = deriveSessionPresentation(session)
  const color = colorForToken(theme, presentation.colorToken)
  // Only ever refines "Running": the other kinds describe process ownership,
  // which a screen scrape has nothing to say about.
  const refinedKey =
    presentation.labelKey === 'status.running' && subStatus
      ? agentSubStatusLabelKey(subStatus)
      : null
  const label = t(refinedKey ?? presentation.labelKey)

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
