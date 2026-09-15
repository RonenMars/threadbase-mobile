import { StyleSheet } from 'react-native'
import { FAB_CLEARANCE } from '@/components/ui/FAB'
import { font, spacing, type Theme } from '@/constants/theme'
import { MONO_FONT } from '@/constants/mono'
import type { RtlStyleKit } from '@/lib/rtl'

export function makeStyles(theme: Theme, rtl: RtlStyleKit) {
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
    gap: spacing.sm,
    minHeight: 44,
  },
  backBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  backCrumb: {
    fontSize: font.xs,
    color: theme.text.secondary,
  },
  backLabel: {
    fontSize: font.base,
    fontWeight: '600',
    color: theme.text.primary,
    fontFamily: MONO_FONT,
    ...rtl.ltr,
  },
  drillList: {
    paddingBottom: FAB_CLEARANCE,
    paddingHorizontal: spacing.sm + 2,
  },
  footerSpinner: {
    paddingVertical: spacing.md,
  },
  })
}
