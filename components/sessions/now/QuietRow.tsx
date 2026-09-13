import { View, Text, Pressable, StyleSheet } from 'react-native'
import { font, spacing, type Theme } from '@/constants/theme'
import { MONO_FONT } from '@/constants/mono'
import { useTheme } from '@/contexts/ThemeContext'
import { formatListTime, formatListTimeAccessible } from '@/components/sessions/shared/formatListTime'

interface Props {
  label: string
  /** `repo · branch`; omitted when the label already is the identity. */
  meta?: string
  timestamp?: string | number | null
  /** Dimmed in the Now list, where weight does the sorting; full in the pushed list. */
  dimmed?: boolean
  onPress?: () => void
  onLongPress?: () => void
  testID?: string
}

/**
 * A session whose title came from a quiet rung of the ladder (a command, or
 * only its identity). It stays in time order as one light line: no second
 * row, no bucket, nothing to expand.
 */
export function QuietRow({ label, meta, timestamp, dimmed = true, onPress, onLongPress, testID }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const time = timestamp ? formatListTime(timestamp) : ''
  const timeA11y = timestamp ? formatListTimeAccessible(timestamp) : undefined

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={meta ? `${label}, ${meta}` : label}
      testID={testID}
      style={[styles.row, dimmed && styles.dimmed]}
    >
      <View style={styles.dot} />
      <Text style={styles.label} numberOfLines={1}>
        {label}
        {meta ? <Text style={styles.meta}>{` · ${meta}`}</Text> : null}
      </Text>
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
      borderBottomColor: `${theme.text.accent}0f`,
    },
    dimmed: { opacity: 0.62 },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.text.secondary,
    },
    label: {
      flex: 1,
      color: theme.text.primary,
      fontSize: font.sm,
      lineHeight: font.sm + 4,
    },
    meta: {
      fontFamily: MONO_FONT,
      fontSize: font.xs,
      color: theme.text.secondary,
    },
    time: {
      fontSize: font.xs,
      color: theme.text.secondary,
      fontVariant: ['tabular-nums'],
    },
  })
}
