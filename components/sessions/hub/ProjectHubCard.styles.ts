import { StyleSheet } from 'react-native'
import { font, spacing, type Theme } from '@/constants/theme'

export function makeStyles(theme: Theme) {
  return StyleSheet.create({
  // Spine wrapper: a flex row that pins the brand-coloured thread spine to
  // the left edge of the card and lets the existing header / body fill the
  // remaining width. Mirrors SessionCard's structure.
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
    color: theme.text.secondary,
    fontSize: font.xs - 1,
    fontWeight: '500',
  },
  headerSuffix: {
    color: theme.text.primary,
    fontSize: font.lg,
    fontWeight: '600',
    lineHeight: font.lg + 4,
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
    color: theme.text.secondary,
    fontSize: font.xs,
  },
  chevron: {
    color: theme.text.secondary,
    fontSize: font.lg,
    fontWeight: '300',
    lineHeight: font.lg,
    width: 16,
    textAlign: 'center',
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
    paddingVertical: spacing.xs,
  },
  seeAllText: {
    color: theme.text.accent,
    fontSize: font.sm,
  },
  })
}
