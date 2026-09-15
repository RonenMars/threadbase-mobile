import { View, StyleSheet } from 'react-native'
import { radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  testID?: string
}

/** Placeholder for history rows while a server is still indexing. */
export function HistorySkeletonRow({ testID = 'history-skeleton' }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  return (
    <View style={styles.row} testID={testID} accessibilityElementsHidden>
      <View style={[styles.bar, styles.title]} />
      <View style={[styles.bar, styles.meta]} />
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      minHeight: 46,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.xs,
      gap: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: theme.bg.secondary,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: spacing.sm,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    bar: {
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.bg.card,
    },
    title: { width: '72%' },
    meta: { width: '40%' },
  })
}
