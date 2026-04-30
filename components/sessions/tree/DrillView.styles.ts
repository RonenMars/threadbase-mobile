import { StyleSheet } from 'react-native'
import { dark, font, spacing } from '@/constants/theme'

export const styles = StyleSheet.create({
  drill: {
    flex: 1,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.border,
    gap: spacing.xs,
    minHeight: 44,
  },
  backChevron: {
    fontSize: 22,
    color: dark.text.accent,
    lineHeight: 24,
    marginTop: -1,
  },
  backLabel: {
    fontSize: font.base,
    fontWeight: '600',
    color: dark.text.primary,
    fontFamily: 'monospace',
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    fontSize: font.xs,
    fontWeight: '600',
    color: dark.text.secondary,
    backgroundColor: dark.bg.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  drillList: {
    paddingBottom: 80,
  },
})
