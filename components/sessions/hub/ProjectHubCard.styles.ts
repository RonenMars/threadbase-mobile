import { StyleSheet } from 'react-native'
import { dark, font, spacing } from '@/constants/theme'

export const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  projectName: {
    flex: 1,
    color: dark.text.primary,
    fontSize: font.base,
    fontWeight: '600',
  },
  countBadge: {
    color: dark.text.secondary,
    fontSize: font.xs,
  },
  chevron: {
    color: dark.text.secondary,
    fontSize: font.lg,
    fontWeight: '300',
    lineHeight: font.lg,
    width: 16,
    textAlign: 'center',
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: dark.border,
    paddingBottom: spacing.md,
  },
  section: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  sectionLabel: {
    color: dark.text.secondary,
    fontSize: font.xs,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  seeAllRow: {
    paddingVertical: spacing.xs,
  },
  seeAllText: {
    color: dark.text.accent,
    fontSize: font.sm,
  },
})
