import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { dark, font, spacing } from '@/constants/theme'

interface Props {
  count: number
  /**
   * Whether at least one of the sessions in the block is live (running /
   * waiting_input). When true, the eyebrow is amber (LIVE); otherwise blue
   * (IDLE). The block colour anchors the section in the brand's
   * amber-vs-blue language: amber = now, blue = thread.
   */
  hasLive: boolean
}

/**
 * Eyebrow header that sits above the active-session block in the merged hub
 * list, e.g. "LIVE · 2" or "IDLE · 2". Uses the brand's eyebrow type rule
 * (Inter Semibold 11, UPPER, +0.08em tracking).
 */
export function LiveSessionsHeader({ count, hasLive }: Props) {
  const { t } = useTranslation('sessions')
  // Inline conditional rather than a dynamic key so the i18n typegen can
  // narrow each call site to a literal key.
  const label = hasLive
    ? t('live.headerLive', { count })
    : t('live.headerIdle', { count })

  // Amber = brand "live / now / running"; blue = brand "thread / archive".
  // We tint the eyebrow itself, not the surface, so the chrome stays calm.
  const tint = hasLive ? dark.status.waiting : dark.text.accent

  return (
    <View style={styles.container} accessibilityRole="header" accessibilityLabel={label}>
      <Text style={[styles.label, { color: tint }]}>{label}</Text>
      <View style={[styles.rule, { backgroundColor: tint, opacity: hasLive ? 0.35 : 0.18 }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  label: {
    fontSize: font.xs,
    fontWeight: '600',
    letterSpacing: 1.0, // ≈0.08em at 11px (eyebrow per DESIGN.md)
  },
  rule: {
    flex: 1,
    height: 1,
  },
})
