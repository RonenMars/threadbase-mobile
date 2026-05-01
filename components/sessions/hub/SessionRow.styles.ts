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
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowPrimary: {
    color: dark.text.primary,
    fontSize: font.sm,
  },
  serverLabel: {
    color: dark.text.accent,
    fontSize: font.xs,
    opacity: 0.75,
  },
  rowDate: {
    color: dark.text.secondary,
    fontSize: font.xs,
    flexShrink: 0,
  },
})
