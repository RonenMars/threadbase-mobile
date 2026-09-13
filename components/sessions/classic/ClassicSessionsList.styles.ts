import { StyleSheet } from 'react-native'
import { spacing } from '@/constants/theme'
import { FAB_CLEARANCE } from '@/components/ui/FAB'

export function makeStyles(bottomInset: number = 0) {
  return StyleSheet.create({
    content: {
      padding: spacing.sm,
      paddingBottom: FAB_CLEARANCE + bottomInset,
      flexGrow: 1,
    },
    emptyContent: {
      flexGrow: 1,
    },
  })
}

export const styles = makeStyles()
