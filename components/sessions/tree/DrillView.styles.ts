import { StyleSheet } from 'react-native'
import { font, spacing, type Theme } from '@/constants/theme'

export function makeStyles(theme: Theme) {
  return StyleSheet.create({
  drill: {
    flex: 1,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
    gap: spacing.xs,
    minHeight: 44,
  },
  backChevron: {
    fontSize: 22,
    color: theme.text.accent,
    lineHeight: 24,
    marginTop: -1,
  },
  backLabel: {
    fontSize: font.base,
    fontWeight: '600',
    color: theme.text.primary,
    fontFamily: 'monospace',
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    fontSize: font.xs,
    fontWeight: '600',
    color: theme.text.secondary,
    backgroundColor: theme.bg.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  drillList: {
    paddingBottom: 80,
  },
  })
}
