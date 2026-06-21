import { StyleSheet } from 'react-native'
import { spacing } from '@/constants/theme'

export function makeStyles(bottomInset: number = 0) {
  return StyleSheet.create({
    content: {
      padding: spacing.sm,
      paddingBottom: spacing.sm + bottomInset,
      flexGrow: 1,
    },
    emptyContent: {
      flexGrow: 1,
    },
  })
}

export const styles = makeStyles()
