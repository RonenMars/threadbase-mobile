import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

interface Props {
  /**
   * When true, the dot pulses on a 1.6s loop (the brand "live / now" signal).
   * When false, the dot is fully opaque and static.
   */
  live: boolean
  color: string
  size?: number
}

/**
 * Small primitive shared by SessionStatusBadge, the tree leaf indicator, and
 * the hub session row. The pulse cadence (0.4 → 1 → 0.4 over 1.6s, ease-out)
 * matches DESIGN.md's "live / running" signal exactly.
 */
export function LiveDot({ live, color, size = 7 }: Props) {
  const opacity = useSharedValue(1)

  useEffect(() => {
    if (live) {
      opacity.value = 0.4
      opacity.value = withRepeat(
        withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }),
        -1,
        true,
      )
    } else {
      cancelAnimation(opacity)
      opacity.value = 1
    }
    return () => cancelAnimation(opacity)
  }, [live, opacity])

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View
      style={[
        styles.dot,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        animatedStyle,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  dot: {},
})
