import { StyleSheet } from 'react-native'
import { FAB_CLEARANCE } from '@/components/ui/FAB'
import { font, spacing, type Theme } from '@/constants/theme'

export function makeStyles(theme: Theme, bottomInset: number = 0) {
  return StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: spacing.sm,
    paddingBottom: FAB_CLEARANCE + bottomInset,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  serverEmpty: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  sectionHeaderText: {
    color: theme.text.secondary,
    fontSize: font.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  resultTitle: {
    color: theme.text.primary,
    fontSize: font.base,
  },
  resultSubtitle: {
    color: theme.text.secondary,
    fontSize: font.sm,
    marginTop: 2,
  },
  })
}
