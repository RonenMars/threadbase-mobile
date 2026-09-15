import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { font, spacing, type Theme } from '@/constants/theme'
import { MONO_FONT } from '@/constants/mono'
import { useTheme } from '@/contexts/ThemeContext'
import { LiveDot } from '@/components/sessions/LiveDot'
import { formatListTime } from '@/components/sessions/shared/formatListTime'

interface Props {
  name: string
  count: number
  timestampMs: number
  dotColor: string | null
  live?: boolean
  onPress: () => void
}

/** A child folder in the path drill: 7px state dot, mono name, count pill, time. */
export function DrillFolderRow({ name, count, timestampMs, dotColor, live, onPress }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const time = timestampMs > 0 ? formatListTime(timestampMs) : ''
  const color = dotColor ?? theme.border

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
      testID={`drill-folder-${name}`}
      style={styles.row}
    >
      {live ? <LiveDot live color={color} size={7} /> : <View style={[styles.dot, { backgroundColor: color }]} />}
      <Text style={styles.name} numberOfLines={1}>{name}</Text>
      <View style={styles.pill}>
        <Text style={styles.pillText}>{count}</Text>
      </View>
      {time ? <Text style={styles.time}>{time}</Text> : null}
    </TouchableOpacity>
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
    },
    dot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
    name: {
      flex: 1,
      minWidth: 0,
      fontFamily: MONO_FONT,
      fontSize: font.sm,
      color: theme.text.primary,
    },
    pill: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    pillText: {
      fontFamily: MONO_FONT,
      fontSize: font.xs,
      color: theme.text.secondary,
      fontVariant: ['tabular-nums'],
    },
    time: {
      fontFamily: MONO_FONT,
      fontSize: font.xs,
      color: theme.text.secondary,
      fontVariant: ['tabular-nums'],
    },
  })
}
