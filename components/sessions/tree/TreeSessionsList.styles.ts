import { StyleSheet } from 'react-native'
import { dark, font, spacing } from '@/constants/theme'

export const styles = StyleSheet.create({
  listContent: {
    paddingTop: 0,
    paddingBottom: spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: dark.text.secondary,
    fontSize: font.base,
    marginTop: 60,
    textAlign: 'center',
  },
})
