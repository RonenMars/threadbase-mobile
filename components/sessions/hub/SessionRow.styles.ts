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
  rowPrimary: {
    flex: 1,
    color: dark.text.primary,
    fontSize: font.sm,
  },
  rowDate: {
    color: dark.text.secondary,
    fontSize: font.xs,
    flexShrink: 0,
  },
})
