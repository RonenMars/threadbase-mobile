import { StyleSheet } from 'react-native'
import { spacing } from '@/constants/theme'

export function makeStyles(bottomInset: number = 0) {
  return StyleSheet.create({
    listContent: {
      paddingTop: 0,
      paddingBottom: spacing.xl + bottomInset,
    },
    unsupportedServer: {
      paddingVertical: spacing.lg,
    },
  })
}

export const styles = makeStyles()
