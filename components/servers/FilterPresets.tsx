import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { DEFAULT_FILTERS, isDefaultFilters, isNeedsMePreset, type ListFilters } from '@/lib/sessionFilters'

interface Props {
  filters: ListFilters
  onChange: (filters: ListFilters) => void
}

/**
 * The two presets, shared by the top of the Now list and the Filter sheet.
 * Two is the ceiling: a third option sends this back to the sheet alone.
 */
export function FilterPresets({ filters, onChange }: Props) {
  const theme = useTheme()
  const { t } = useTranslation('servers')
  const styles = makeStyles(theme)
  const needsMe = isNeedsMePreset(filters)
  const everything = isDefaultFilters(filters)

  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={() => onChange({ ...DEFAULT_FILTERS, tiers: ['needsYou'] })}
        style={[styles.preset, styles.presetNeedsMe, needsMe && styles.presetNeedsMeOn]}
        accessibilityRole="button"
        accessibilityState={{ selected: needsMe }}
        testID="preset-needs-me"
      >
        <View style={[styles.dot, { backgroundColor: theme.status.waiting }]} />
        <Text style={[styles.text, { color: theme.status.waiting }]}>{t('filter.presetNeedsMe')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onChange(DEFAULT_FILTERS)}
        style={[styles.preset, everything && styles.presetOn]}
        accessibilityRole="button"
        accessibilityState={{ selected: everything }}
        testID="preset-everything"
      >
        <Text style={[styles.text, everything && styles.textOn]}>{t('filter.presetEverything')}</Text>
      </TouchableOpacity>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    row: { flexDirection: 'row', gap: spacing.sm },
    preset: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs + 3,
      height: 44,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bg.card,
    },
    presetNeedsMe: { flex: 1, borderColor: `${theme.status.waiting}80` },
    presetNeedsMeOn: { backgroundColor: `${theme.status.waiting}29`, borderColor: theme.status.waiting },
    presetOn: { borderColor: theme.text.accent, backgroundColor: theme.bg.primary },
    dot: { width: 8, height: 8, borderRadius: radius.full },
    text: { color: theme.text.secondary, fontSize: font.sm + 1, fontWeight: '600' },
    textOn: { color: theme.text.primary },
  })
}
