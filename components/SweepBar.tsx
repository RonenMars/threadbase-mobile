import { useEffect } from 'react'
import { useWindowDimensions, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated'

const P5_START = 3000
const P5_DURATION = 2500

export function SweepBar() {
  const { width: screenWidth } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const sweepBarTop = insets.top + 8

  const barWidth = useSharedValue(0)

  useEffect(() => {
    barWidth.value = withDelay(
      P5_START,
      withTiming(screenWidth, {
        duration: P5_DURATION,
        easing: Easing.linear,
      })
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const barStyle = useAnimatedStyle(() => ({
    width: barWidth.value,
    opacity: barWidth.value > 0 ? 1 : 0,
  }))

  return (
    <Animated.View style={[styles.sweepBar, { top: sweepBarTop }, barStyle]} />
  )
}

const styles = StyleSheet.create({
  sweepBar: {
    position: 'absolute',
    left: 0,
    height: 4,
    backgroundColor: '#79c0ff',
    shadowColor: '#79c0ff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 4,
    zIndex: 1,
  },
})
