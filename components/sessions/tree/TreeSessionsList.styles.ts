import { StyleSheet } from 'react-native'
import { spacing } from '@/constants/theme'
import { FAB_CLEARANCE } from '@/components/ui/FAB'

export function makeStyles(bottomInset: number = 0) {
  return StyleSheet.create({
    listContent: {
      paddingTop: 0,
      paddingBottom: FAB_CLEARANCE + bottomInset,
    },
    unsupportedServer: {
      paddingVertical: spacing.lg,
    },
  })
}

export const styles = makeStyles()
