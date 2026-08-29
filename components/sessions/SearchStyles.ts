import { StyleSheet } from 'react-native'
import { font, spacing, type Theme } from '@/constants/theme'
import { rtlStyleKit, type Direction } from '@/lib/rtl'

export function makeStyles(theme: Theme, direction: Direction) {
  const rtl = rtlStyleKit(direction)
  return StyleSheet.create({
  searchBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  searchInput: {
    backgroundColor: theme.bg.card,
    color: theme.text.primary,
    fontSize: font.base,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    ...rtl.copy,
  },
  listContent: {
    padding: spacing.sm,
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
