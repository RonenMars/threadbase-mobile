import { StyleSheet } from 'react-native'
import { FAB_CLEARANCE } from '@/components/ui/FAB'
import { font, spacing, type Theme } from '@/constants/theme'
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
    gap: spacing.xs,
    minHeight: 44,
  },
  backLabel: {
    fontSize: font.base,
    fontWeight: '600',
    color: theme.text.primary,
    fontFamily: 'monospace',
    flex: 1,
    ...rtl.ltr,
  },
  drillList: {
    paddingBottom: FAB_CLEARANCE,
  },
  footerSpinner: {
    paddingVertical: spacing.md,
  },
  })
}
