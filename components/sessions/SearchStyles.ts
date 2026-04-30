import { StyleSheet } from 'react-native'
import { dark, font, spacing } from '@/constants/theme'

export const searchStyles = StyleSheet.create({
  searchBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: dark.border,
  },
  searchInput: {
    backgroundColor: dark.bg.card,
    color: dark.text.primary,
    fontSize: font.base,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: dark.border,
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
    color: dark.text.secondary,
    fontSize: font.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.border,
  },
  resultTitle: {
    color: dark.text.primary,
    fontSize: font.base,
  },
  resultSubtitle: {
    color: dark.text.secondary,
    fontSize: font.sm,
    marginTop: 2,
  },
})
