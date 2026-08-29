import { StyleSheet } from 'react-native'
import { font, spacing, type Theme } from '@/constants/theme'

export function makeStyles(theme: Theme) {
  return StyleSheet.create({
  drillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
    gap: spacing.sm,
    minHeight: 44,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  drillContent: {
    flex: 1,
  },
  drillLabel: {
    fontSize: font.base,
    color: theme.text.primary,
    fontWeight: '600',
  },
  drillStatus: {
    fontSize: font.xs,
    marginTop: 2,
    textTransform: 'capitalize',
    color: theme.text.secondary,
  },
  badge: {
    backgroundColor: 'rgba(88,166,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: font.xs,
    color: theme.text.accent,
    fontWeight: '600',
  },
  })
}
