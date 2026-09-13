import type { ReactNode } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { ServerChip } from '@/components/sessions/shared/ServerChip'
import { SERVER_COLOR_DEFAULT } from '@/components/sessions/shared/serverPalette'

interface Props {
  title: string
  /** Rail and border colour; the card itself is always opaque `bg.secondary`. */
  color: string
  /** Solid border for Needs-you, faint accent border for Working. */
  emphasis: 'solid' | 'faint'
  serverLabel?: string | null
  serverColor?: string | null
  onPress: () => void
  onLongPress?: () => void
  accessibilityLabel: string
  testID?: string
  isFirst?: boolean
  children: ReactNode
}

/** Opaque card with a 3 px state rail: the shell shared by Needs-you and Working. */
export function LiveCard({
  title,
  color,
  emphasis,
  serverLabel,
  serverColor,
  onPress,
  onLongPress,
  accessibilityLabel,
  testID,
  isFirst,
  children,
}: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const borderColor = emphasis === 'solid' ? `${color}80` : `${theme.text.accent}2e`

  return (
    <View style={[styles.card, { borderColor }]} testID={isFirst ? 'first-session-card' : undefined}>
      <TouchableOpacity
        testID={testID}
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={styles.row}
      >
        <View style={[styles.rail, { backgroundColor: color }]} />
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>{title}</Text>
            {serverLabel ? (
              <ServerChip label={serverLabel} color={serverColor ?? SERVER_COLOR_DEFAULT} variant="label" />
            ) : null}
          </View>
          {children}
        </View>
      </TouchableOpacity>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.bg.secondary,
      borderWidth: 1,
      borderRadius: radius.lg - 4,
      overflow: 'hidden',
      marginBottom: spacing.sm - 1,
    },
    row: { flexDirection: 'row', alignItems: 'stretch' },
    rail: { width: 3 },
    body: {
      flex: 1,
      padding: spacing.md,
      gap: spacing.sm - 1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    title: {
      flex: 1,
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
      lineHeight: font.base + 4,
    },
  })
}
