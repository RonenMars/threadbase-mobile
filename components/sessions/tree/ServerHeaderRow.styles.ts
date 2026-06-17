import { StyleSheet } from 'react-native'
import { font, spacing, type Theme } from '@/constants/theme'

export function makeStyles(theme: Theme) {
  return StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  label: {
    fontSize: font.xs,
    color: theme.text.secondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    flex: 1,
  },
  count: {
    fontSize: font.xs,
    color: theme.text.secondary,
  },
  chevron: {
    fontSize: 18,
    color: theme.text.secondary,
    lineHeight: 20,
    marginTop: -1,
    width: 16,
    textAlign: 'center',
    flexShrink: 0,
  },
  chevronOpen: {
    transform: [{ rotate: '90deg' }],
    color: theme.text.accent,
  },
  })
}
