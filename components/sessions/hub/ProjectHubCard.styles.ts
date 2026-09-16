import { StyleSheet } from 'react-native'
import { font, spacing, type Theme } from '@/constants/theme'
import { MONO_FONT } from '@/constants/mono'
import type { RtlStyleKit } from '@/lib/rtl'

export function makeStyles(theme: Theme, rtl: RtlStyleKit) {
  return StyleSheet.create({
  // Spine wrapper: a flex row that pins the brand-coloured thread spine to
  // the left edge of the card and lets the existing header / body fill the
  // remaining width. Matches the live-card rail.
  spineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  spine: {
    width: 3,
  },
  spinePlaceholder: {
    width: 3,
  },
  spineRowBody: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  headerBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  headerParent: {
    fontFamily: MONO_FONT,
    color: theme.text.secondary,
    fontSize: font.xs - 1,
    fontWeight: '500',
    ...rtl.ltr,
  },
  headerSuffix: {
    color: theme.text.primary,
    fontSize: font.lg,
    fontWeight: '600',
    lineHeight: font.lg + 4,
    ...rtl.ltr,
  },
  headerActivity: {
    color: theme.text.secondary,
    fontSize: font.xs,
  },
  projectName: {
    flex: 1,
    color: theme.text.primary,
    fontSize: font.base,
    fontWeight: '600',
  },
  countBadge: {
    fontFamily: MONO_FONT,
    color: theme.text.secondary,
    fontSize: font.xs,
    fontVariant: ['tabular-nums'],
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingBottom: spacing.md,
  },
  section: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  sectionLabel: {
    color: theme.text.secondary,
    fontSize: font.xs,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  seeAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  bodySpinner: {
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  seeAllText: {
    color: theme.text.accent,
    fontSize: font.sm,
  },
  })
}
