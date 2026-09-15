import { StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FAB_CLEARANCE } from '@/components/ui/FAB'
import { useTheme } from '@/contexts/ThemeContext'

/** Fade under the action pill so the last row can pass through it. */
export function ListBottomScrim() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const height = FAB_CLEARANCE + insets.bottom

  return (
    <View pointerEvents="none" style={[styles.wrap, { height }]}>
      <LinearGradient
        colors={[`${theme.bg.primary}00`, theme.bg.primary]}
        style={StyleSheet.absoluteFill}
        testID="list-bottom-scrim"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
})
