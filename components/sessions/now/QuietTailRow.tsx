import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { CaretRight } from 'phosphor-react-native'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  count: number
  onPress: () => void
}

/**
 * The footer of a time group whose quiet rows outnumbered the threshold. It
 * says what they are, not how they are drawn, and tapping pushes a plain list
 * of them rather than expanding in place.
 */
export function QuietTailRow({ count, onPress }: Props) {
  const theme = useTheme()
  const { t } = useTranslation('sessions')
  const styles = makeStyles(theme)
  const label = t('row.quietTail', { count })

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID="quiet-tail"
      style={styles.row}
    >
      <View style={styles.dot} />
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
      <CaretRight size={14} color={theme.text.secondary} />
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
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.xs,
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.text.secondary,
      opacity: 0.6,
    },
    label: {
      flex: 1,
      color: theme.text.secondary,
      fontSize: font.sm,
      fontWeight: '500',
    },
  })
}
