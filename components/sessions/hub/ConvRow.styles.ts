import { StyleSheet } from 'react-native'
import { dark, font, spacing } from '@/constants/theme'

export const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.sm,
    minHeight: 36,
  },
  convRowInner: {
    flex: 1,
    gap: 2,
  },
  convTitle: {
    color: dark.text.primary,
    fontSize: font.sm,
  },
  rowSecondary: {
    color: dark.text.secondary,
    fontSize: font.xs,
  },
  rowDate: {
    color: dark.text.secondary,
    fontSize: font.xs,
    flexShrink: 0,
  },
})
