import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { CaretRight } from 'phosphor-react-native'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  count: number
  hasLive: boolean
  collapsed?: boolean
  onToggle?: () => void
}

/**
 * Eyebrow header that sits above the active-session block in the merged hub
 * list, e.g. "LIVE · 2" or "IDLE · 2". Uses the brand's eyebrow type rule
 * (Inter Semibold 11, UPPER, +0.08em tracking).
 */
export function LiveSessionsHeader({ count, hasLive, collapsed, onToggle }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { t } = useTranslation('sessions')
  const label = hasLive
    ? t('live.headerLive', { count })
    : t('live.headerIdle', { count })

  const tint = hasLive ? theme.status.waiting : theme.text.accent
  const collapsible = onToggle !== undefined

  const inner = (
    <View style={styles.container} accessibilityRole="header" accessibilityLabel={label}>
      {collapsible && (
        <CaretRight
          size={12}
          color={tint}
          weight="bold"
         
          style={{ transform: [{ rotate: collapsed ? '0deg' : '90deg' }] }}
        />
      )}
      <Text style={[styles.label, { color: tint }]}>{label}</Text>
      <View style={[styles.rule, { backgroundColor: tint, opacity: hasLive ? 0.35 : 0.18 }]} />
    </View>
  )

  if (collapsible) {
    return (
      <TouchableOpacity
        testID="live-sessions-header"
        onPress={onToggle}
        activeOpacity={0.7}
      >
        {inner}
      </TouchableOpacity>
    )
  }
  return inner
}

function makeStyles(_theme: Theme) {
  return StyleSheet.create({
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
}
