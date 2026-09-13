import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { CaretRight } from 'phosphor-react-native'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { MONO_FONT } from '@/constants/mono'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  titles: string[]
  expanded: boolean
  onToggle: () => void
}

/**
 * Three or more rows whose titles the pipeline rejected, folded into one line
 * so a "hi" never weighs the same as a 500-message thread. Display-layer only.
 */
export function GroupedNoiseRow({ titles, expanded, onToggle }: Props) {
  const theme = useTheme()
  const { t } = useTranslation('sessions')
  const styles = makeStyles(theme)
  const label = t('row.groupedOneLine', { count: titles.length })

  return (
    <Pressable
      onPress={onToggle}
      style={styles.row}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={label}
      testID="grouped-noise-row"
    >
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{label}</Text>
          <Text style={styles.pill}>{t('row.groupedPill')}</Text>
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>{titles.join(' · ')}</Text>
      </View>
      <View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}>
        <CaretRight size={16} color={theme.text.secondary} />
      </View>
    </Pressable>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm + 2,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: `${theme.text.accent}17`,
      opacity: 0.72,
    },
    body: { flex: 1, minWidth: 0, gap: 3 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
    title: {
      flexShrink: 1,
      color: theme.text.primary,
      fontSize: font.sm,
      fontWeight: '500',
    },
    pill: {
      fontFamily: MONO_FONT,
      fontSize: font.xs - 2,
      fontWeight: '600',
      letterSpacing: 0.5,
      color: theme.text.secondary,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.full,
      paddingHorizontal: 5,
      paddingVertical: 3,
    },
    subtitle: {
      color: theme.text.secondary,
      fontSize: font.xs,
      lineHeight: font.xs + 4,
    },
  })
}
