import { useEffect, useState } from 'react'
import { Animated, Easing } from 'react-native'
import { useReduceMotion } from '@/hooks/useAccessibilitySettings'

interface Props {
  /**
   * When true, the dot pulses on a 1.6s loop (the brand "live / now" signal).
   * When false, the dot is fully opaque and static.
   */
  live: boolean
  color: string
  size?: number
}

const PULSE_HALF_MS = 800

/**
 * Small primitive shared by SessionStatusBadge, the tree leaf indicator, and
 * the hub session row. The pulse cadence (0.4 → 1 → 0.4 over 1.6s, ease-out)
 * matches DESIGN.md's "live / running" signal exactly.
 *
 * React Native's own native driver, not Reanimated: on Fabric a Reanimated
 * animation commits the whole surface's shadow tree once per frame and re-runs
 * Yoga with it, which a hub full of live rows pays continuously. The native
 * driver writes opacity straight to the view and never enters the shadow tree.
 */
export function LiveDot({ live, color, size = 7 }: Props) {
  const reduceMotion = useReduceMotion()
  const [opacity] = useState(() => new Animated.Value(1))
  const animate = live && !reduceMotion

  useEffect(() => {
    if (!animate) {
      opacity.setValue(1)
      return
    }
    opacity.setValue(0.4)
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: PULSE_HALF_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: PULSE_HALF_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [animate, opacity])

  return (
    <Animated.View
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        { opacity },
      ]}
    />
  )
}
