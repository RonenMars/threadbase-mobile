import { StyleSheet } from 'react-native'
import { font, spacing, type Theme } from '@/constants/theme'

export function makeStyles(theme: Theme, bottomInset: number = 0) {
  return StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bg.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  searchInput: {
    flex: 1,
    color: theme.text.primary,
    fontSize: font.base,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  clearBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  listContent: {
    padding: spacing.sm,
    paddingBottom: spacing.sm + bottomInset,
  },
  emptyListContent: {
    flexGrow: 1,
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
