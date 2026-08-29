import { StyleSheet } from 'react-native'
import { font, spacing, type Theme } from '@/constants/theme'
import type { RtlStyleKit } from '@/lib/rtl'

export function makeStyles(theme: Theme, rtl: RtlStyleKit) {
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
    ...rtl.ltr,
  },
  count: {
    fontSize: font.xs,
    color: theme.text.secondary,
    ...rtl.ltr,
  },
  })
}
