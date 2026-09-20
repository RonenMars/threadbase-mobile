import { View, Text, Pressable, StyleSheet } from 'react-native'
import { font, spacing, type Theme } from '@/constants/theme'
import { MONO_FONT } from '@/constants/mono'
import { useTheme } from '@/contexts/ThemeContext'
import { LiveDot } from '@/components/sessions/LiveDot'

export type SectionTone = 'needsYou' | 'working' | 'muted'

interface Props {
  /** Already formatted, e.g. "NEEDS YOU · 1". */
  label: string
  tone: SectionTone
  /** Trailing count for muted sections; live sections carry it in the label. */
  count?: number
  /** Trailing link, e.g. the OLDER tier's Show / Hide. */
  action?: { label: string; onPress: () => void; testID?: string }
}

/**
 * Mono eyebrow above a Now section: state-coloured dot and rule for the two
 * live tiers, plain secondary text for history. Same device as onboarding's
 * `> 01 / LANGUAGE`, on the existing mono stack rather than a new font.
 */
export function SectionEyebrow({ label, tone, count, action }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const color =
    tone === 'needsYou' ? theme.status.waiting : tone === 'working' ? theme.status.running : theme.text.secondary
  const live = tone !== 'muted'

  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel={label}>
      {live ? <LiveDot live color={color} size={8} /> : null}
      <Text style={[styles.label, { color }]}>{label}</Text>
      <View style={[styles.rule, live ? { backgroundColor: color, opacity: 0.28 } : styles.ruleMuted]} />
      {count != null ? <Text style={styles.count}>{count}</Text> : null}
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={12} accessibilityRole="button" testID={action.testID}>
          <Text style={styles.action}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm + 2,
      paddingHorizontal: spacing.xs,
    },
    label: {
      fontFamily: MONO_FONT,
      fontSize: font.xs,
      fontWeight: '600',
      letterSpacing: 1.5,
    },
    rule: { flex: 1, height: 1 },
    ruleMuted: { backgroundColor: theme.border },
    count: {
      fontFamily: MONO_FONT,
      fontSize: font.xs,
      color: theme.text.secondary,
      fontVariant: ['tabular-nums'],
    },
    action: {
      fontSize: font.xs,
      fontWeight: '600',
      color: theme.text.accent,
    },
  })
}
