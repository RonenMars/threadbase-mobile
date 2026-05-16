import { StyleSheet } from 'react-native'
import { dark, font, radius, spacing } from '@/constants/theme'

export const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingRight: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.border,
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
    marginRight: spacing.xs,
    flexShrink: 0,
  },
  chevron: {
    fontSize: 18,
    color: dark.text.secondary,
    lineHeight: 20,
    marginTop: -1,
  },
  chevronOpen: {
    transform: [{ rotate: '90deg' }],
    color: dark.text.accent,
  },
  leafDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: dark.text.secondary,
  },
  label: {
    flex: 1,
    fontSize: font.sm,
    color: dark.text.secondary,
  },
  labelWithItems: {
    color: dark.text.primary,
    fontWeight: '500',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: spacing.xs,
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
    color: dark.text.accent,
    fontWeight: '600',
  },
  time: {
    fontSize: font.xs,
    color: dark.text.secondary,
    minWidth: 44,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  chatIcon: {
    marginRight: 4,
  },
})
