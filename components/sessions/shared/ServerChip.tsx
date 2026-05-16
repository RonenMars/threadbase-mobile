import { View, Text, Pressable, StyleSheet } from 'react-native'
import { dark, font, radius, spacing } from '@/constants/theme'
import { SERVER_COLOR_DEFAULT, initialsFor } from './serverPalette'

export type ServerChipVariant = 'label' | 'letter' | 'symbol'

export interface ServerChipProps {
  label: string
  /** Server's assigned color. Defaults to the brand blue when unset. */
  color?: string
  variant?: ServerChipVariant
  /** Optional onPress handler — quick-filter the current view to this server. */
  onPress?: () => void
  onLongPress?: () => void
  /** Max characters before truncation in the 'label' variant. Default 12. */
  maxLabelChars?: number
  testID?: string
}

/**
 * Server-identity chip used in conversation list rows when more than one
 * server is active. Default variant is Scottish-Gov status-tag style:
 * a pill with the server color as a border + 12%-opacity fill + label.
 *
 * Color is never the only signal — the visible label/letter/symbol carries
 * the accessible name. Pair this chip with a left accent strip on the row
 * (3px wide) in the same color.
 */
export function ServerChip({
  label,
  color = SERVER_COLOR_DEFAULT,
  variant = 'label',
  onPress,
  onLongPress,
  maxLabelChars = 12,
  testID,
}: ServerChipProps) {
  const a11yLabel = `Server: ${label}`

  if (variant === 'letter' || variant === 'symbol') {
    const display = variant === 'letter' ? initialsFor(label) : ''
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityLabel={a11yLabel}
        accessibilityRole="button"
        testID={testID}
        hitSlop={6}
        style={[styles.tile, { backgroundColor: color }]}
      >
        <Text style={styles.tileText} numberOfLines={1}>{display}</Text>
      </Pressable>
    )
  }

  // Default: 'label' — Scottish-Gov status-tag style.
  const display = label.length > maxLabelChars ? label.slice(0, maxLabelChars - 1) + '…' : label
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityLabel={a11yLabel}
      accessibilityRole="button"
      testID={testID}
      hitSlop={6}
      style={[styles.pill, { borderColor: color, backgroundColor: `${color}1f` }]}
    >
      <Text style={[styles.pillText, { color }]} numberOfLines={1}>{display}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm - 2,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontSize: font.xs - 2,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  tile: {
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: {
    color: dark.bg.primary,
    fontSize: 10,
    fontWeight: '700',
  },
})
