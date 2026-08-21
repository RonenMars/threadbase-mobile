import { StyleSheet } from 'react-native'
import { font, radius, spacing, type Theme } from '@/constants/theme'

export function makeStyles(theme: Theme) {
  return StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingEnd: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
    minHeight: 44,
    position: 'relative',
  },
  gutter: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(99,179,255,0.08)',
  },
  iconSlot: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: spacing.xs,
    flexShrink: 0,
  },
  chevron: {
    fontSize: 18,
    color: theme.text.secondary,
    lineHeight: 20,
    marginTop: -1,
  },
  chevronOpen: {
    transform: [{ rotate: '90deg' }],
    color: theme.text.accent,
  },
  leafDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.text.secondary,
  },
  label: {
    flex: 1,
    fontSize: font.sm,
    color: theme.text.secondary,
  },
  labelWithItems: {
    color: theme.text.primary,
    fontWeight: '500',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginStart: spacing.xs,
    flexShrink: 0,
  },
  badge: {
    backgroundColor: 'rgba(88,166,255,0.12)',
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: font.xs,
    color: theme.text.accent,
    fontWeight: '600',
  },
  time: {
    fontSize: font.xs,
    color: theme.text.secondary,
    minWidth: 44,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  chatIcon: {
    marginEnd: 4,
  },
  })
}
