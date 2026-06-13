import React, { useEffect, useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated'

const WIDTH = 280
const HEIGHT = 80
const COL_COUNT = 18
const CHARS = '01アイウエオカキクケコ<>{}[]|/'
const GREEN = '#00ff41'
const GREEN_DIM = 'rgba(0,255,65,0.35)'
const BG = 'rgba(0,0,0,0.85)'

interface Col {
  id: number
  x: number
  char: string
  duration: number
  delay: number
}

function RainColumn({ x, char, duration, delay }: Omit<Col, 'id'>) {
  const translateY = useSharedValue(-20)
  const opacity = useSharedValue(0)

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withTiming(HEIGHT + 20, { duration, easing: Easing.linear }),
        -1,
        false,
      ),
    )
    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: duration * 0.15, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      ),
    )
    // mount-only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }))

  return (
    <Animated.Text style={[styles.char, { left: x }, style]}>
      {char}
    </Animated.Text>
  )
}

export function MatrixRain() {
  const cols = useMemo<Col[]>(() => {
    const colWidth = WIDTH / COL_COUNT
    return Array.from({ length: COL_COUNT }, (_, i) => ({
      id: i,
      x: i * colWidth + colWidth * 0.1,
      char: CHARS[Math.floor(((i * 7 + 3) % CHARS.length))],
      duration: 900 + ((i * 137) % 600),
      delay: (i * 83) % 800,
    }))
  }, [])

  return (
    <View style={styles.container} pointerEvents="none">
      {cols.map((col) => (
        <RainColumn key={col.id} x={col.x} char={col.char} duration={col.duration} delay={col.delay} />
      ))}
      {/* fade top/bottom edges */}
      <View style={styles.fadeTop} pointerEvents="none" />
      <View style={styles.fadeBottom} pointerEvents="none" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: BG,
    borderRadius: 8,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  char: {
    position: 'absolute',
    fontFamily: 'monospace',
    fontSize: 13,
    color: GREEN,
    textShadowColor: GREEN_DIM,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  fadeTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 20,
    backgroundColor: BG,
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 20,
    backgroundColor: BG,
  },
})
