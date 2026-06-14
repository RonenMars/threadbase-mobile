import { StyleSheet } from 'react-native'
import { font, spacing, type Theme } from '@/constants/theme'

export function makeStyles(theme: Theme) {
  return StyleSheet.create({
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
    color: theme.text.primary,
    fontSize: font.sm,
  },
  serverLabel: {
    color: theme.text.accent,
    fontSize: font.xs,
    opacity: 0.75,
  },
  rowDate: {
    color: theme.text.secondary,
    fontSize: font.xs,
    flexShrink: 0,
  },
  })
}
