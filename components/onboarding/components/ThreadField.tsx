import React, { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg'
import { colors } from '../theme'

const AnimatedPath = Animated.createAnimatedComponent(Path)

const VB_W = 360
const VB_H = 580
const THREAD_COUNT = 7

// Each thread is a sinusoidal path running across the artboard.
function pathForRow(i: number) {
  const y0 = 110 + i * 55
  const y1 = 85 + i * 55
  const y2 = 120 + i * 55
  return `M-30 ${y0} Q 90 ${y1} 180 ${y2} T 400 ${y0}`
}

function PulsingThread({ i }: { i: number }) {
  const offset = useSharedValue(0)

  useEffect(() => {
    offset.value = withDelay(
      i * 300,
      withRepeat(
        withSequence(
          withTiming(120, { duration: (5000 + i * 400) / 2, easing: Easing.linear }),
          withTiming(0, { duration: (5000 + i * 400) / 2, easing: Easing.linear }),
        ),
        -1,
        false,
      ),
    )
  }, [i, offset])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: offset.value,
  }))

  const isAmber = i % 2 === 1
  return (
    <AnimatedPath
      d={pathForRow(i)}
      fill="none"
      stroke={isAmber ? 'url(#threadAmber)' : 'url(#threadBlue)'}
      strokeWidth={i % 3 === 0 ? 1.4 : 0.8}
      strokeDasharray={isAmber ? '2 8' : '4 6'}
      animatedProps={animatedProps}
    />
  )
}

export function ThreadField() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid slice"
        width="100%"
        height="100%"
        style={{ opacity: 0.55 }}
      >
        <Defs>
          <LinearGradient id="threadBlue" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor={colors.blue400} stopOpacity={0} />
            <Stop offset="50%" stopColor={colors.blue400} stopOpacity={0.9} />
            <Stop offset="100%" stopColor={colors.blue400} stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="threadAmber" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor={colors.amber400} stopOpacity={0} />
            <Stop offset="50%" stopColor={colors.amber400} stopOpacity={0.7} />
            <Stop offset="100%" stopColor={colors.amber400} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {Array.from({ length: THREAD_COUNT }).map((_, i) => (
          <PulsingThread key={i} i={i} />
        ))}
      </Svg>
    </View>
  )
}
