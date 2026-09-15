import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { font, spacing, type Theme } from '@/constants/theme'
import { MONO_FONT } from '@/constants/mono'
import { useTheme } from '@/contexts/ThemeContext'
import { formatListTime, formatListTimeAccessible } from '@/components/sessions/shared/formatListTime'
import type { SessionStatusLabel } from '@/lib/sessionPresentation'

interface Props {
  title: string
  statusLabel?: SessionStatusLabel | null
  timestamp?: string | number | null
  onPress?: () => void
  onLongPress?: () => void
  testID?: string
}

export function cantResumeReason(
  statusLabel: SessionStatusLabel | null | undefined,
  t: TFunction<'sessions'>,
): string {
  switch (statusLabel) {
    case 'unavailableWorktree':
      return t('unavailable.worktree')
    case 'unavailablePath':
      return t('status.unavailablePath')
    default:
      return t('status.cantResume')
  }
}

/** A history row that cannot be resumed: title plus a red reason, never a preview echo. */
export function CantResumeRow({ title, statusLabel, timestamp, onPress, onLongPress, testID }: Props) {
  const theme = useTheme()
  const { t } = useTranslation('sessions')
  const styles = makeStyles(theme)
  const reason = cantResumeReason(statusLabel, t)
  const time = timestamp ? formatListTime(timestamp) : ''
  const timeA11y = timestamp ? formatListTimeAccessible(timestamp) : undefined

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${reason}`}
      testID={testID}
      style={styles.row}
    >
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.reason} numberOfLines={1}>{reason}</Text>
      </View>
      {time ? (
        <Text style={styles.time} accessibilityLabel={timeA11y} numberOfLines={1}>{time}</Text>
      ) : null}
    </Pressable>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm + 1,
      minHeight: 44,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: `${theme.text.accent}17`,
    },
    body: { flex: 1, minWidth: 0, gap: 3 },
    title: {
      color: theme.text.secondary,
      fontSize: font.sm,
      fontWeight: '600',
    },
    reason: {
      color: theme.status.failed,
      fontSize: font.xs,
    },
    time: {
      fontFamily: MONO_FONT,
      fontSize: font.xs,
      color: theme.text.secondary,
      fontVariant: ['tabular-nums'],
    },
  })
}
