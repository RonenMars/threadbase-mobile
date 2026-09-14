import { StyleSheet } from 'react-native'
import { FAB_CLEARANCE } from '@/components/ui/FAB'
import { font, spacing, type Theme } from '@/constants/theme'
import { MONO_FONT } from '@/constants/mono'

export function makeStyles(theme: Theme, bottomInset: number = 0) {
  return StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: spacing.sm,
    paddingBottom: FAB_CLEARANCE + bottomInset,
  },
  filterField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg.secondary,
  },
  filterInput: {
    flex: 1,
    fontFamily: MONO_FONT,
    color: theme.text.primary,
    fontSize: font.sm,
    paddingVertical: spacing.sm,
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
