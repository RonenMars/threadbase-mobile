import { useEffect } from 'react'
import { THREAD_LINES, LINE_GAP } from './MatrixRain'
import { View, StyleSheet, useWindowDimensions } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  runOnJS,
} from 'react-native-reanimated'

const COLORS = {
  bg: '#0d1117',
  blueBright: '#79c0ff',
  blueMid: '#58a6ff',
  blueDim: 'rgba(88,166,255,0.4)',
  orange: '#f0883e',
  text: '#c9d1d9',
} as const

const NODE_SIZE = 14
const LINE_HEIGHT = 4
const VERTICAL_LINE_WIDTH = 2

// Timing constants (ms)
const P1_DURATION = 700   // vertical line draw
const P2_START = 700      // when thread lines begin
const P2_STAGGER = 220    // gap between each line
const P2_LINE_DUR = 400   // each line draw duration
const P3_START = 2000    // text fade-up
const P3_DURATION = 500  // text animation duration
const P4_START = 2500    // vertical line exit
const P4_DURATION = 500  // vertical line exit duration

const P5_START = 3000
const FADE_OUT_START = P3_START + P3_DURATION + 300 // exit right after logo text is revealed
const FADE_OUT_DUR = 200

interface Props {
  onComplete: () => void
}

function ThreadLine({
  index,
  widthPct,
  color,
  nodeColor,
  nodeLeft,
  lineLeft,
  screenWidth,
}: {
  index: number
  widthPct: number
  color: string
  nodeColor: string
  nodeLeft: number
  lineLeft: number
  screenWidth: number
}) {
  const lineWidth = useSharedValue(0)
  const nodeScale = useSharedValue(0)

  useEffect(() => {
    const delay = P2_START + index * P2_STAGGER
    lineWidth.value = withDelay(
      delay,
      withTiming(screenWidth * widthPct, {
        duration: P2_LINE_DUR,
        easing: Easing.out(Easing.cubic),
      })
    )
    nodeScale.value = withDelay(
      delay,
      withSpring(1, { damping: 12, stiffness: 200 })
    )
    // Mount-only animation; SharedValues are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lineStyle = useAnimatedStyle(() => ({
    width: lineWidth.value,
  }))

  const nodeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: nodeScale.value }],
  }))

  return (
    <View style={[styles.threadRow, { height: LINE_GAP }]}>
      <Animated.View
        style={[
          styles.node,
          {
            left: nodeLeft,
            borderColor: nodeColor,
            backgroundColor: index === 4 ? 'rgba(240,136,62,0.2)' : 'transparent',
          },
          nodeStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.line,
          {
            left: lineLeft,
            backgroundColor: color,
            shadowColor: color,
          },
          lineStyle,
        ]}
      />
    </View>
  )
}


export function SplashAnimation({ onComplete }: Props) {
  const { width: screenWidth } = useWindowDimensions()
  const nodeLeft = screenWidth * 0.32
  const lineLeft = nodeLeft + NODE_SIZE / 2 + 8
  const totalHeight = (THREAD_LINES.length - 1) * LINE_GAP

  // Phase 1: vertical line
  const vLineHeight = useSharedValue(0)

  // Phase 3: text reveal
  const textOpacity = useSharedValue(0)
  const textTranslateY = useSharedValue(8)

  // Phase 4: vertical line exit
  const vLineTranslateY = useSharedValue(0)
  const vLineOpacity = useSharedValue(1)

  // Phase 5: dissolve thread lines and nodes
  const dissolveOpacity = useSharedValue(1)

  // Phase 3 text fade out
  const textFadeOut = useSharedValue(1)

  // Final fade
  const containerOpacity = useSharedValue(1)

  useEffect(() => {
    vLineHeight.value = withTiming(totalHeight, {
      duration: P1_DURATION,
      easing: Easing.out(Easing.cubic),
    })

    // Phase 3: text
    textOpacity.value = withDelay(
      P3_START,
      withTiming(1, { duration: P3_DURATION, easing: Easing.out(Easing.cubic) })
    )
    textTranslateY.value = withDelay(
      P3_START,
      withTiming(0, { duration: P3_DURATION, easing: Easing.out(Easing.cubic) })
    )

    // Phase 4: vertical line exits downward
    vLineTranslateY.value = withDelay(
      P4_START,
      withTiming(350, { duration: P4_DURATION, easing: Easing.in(Easing.quad) })
    )
    vLineOpacity.value = withDelay(
      P4_START,
      withTiming(0, { duration: P4_DURATION, easing: Easing.in(Easing.quad) })
    )

    // Phase 5: dissolve threads
    dissolveOpacity.value = withDelay(
      P5_START,
      withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) })
    )
    textFadeOut.value = withDelay(
      P5_START,
      withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) })
    )

    // Final fade out
    containerOpacity.value = withDelay(
      FADE_OUT_START,
      withTiming(0, { duration: FADE_OUT_DUR }, (finished) => {
        if (finished) {
          runOnJS(onComplete)()
        }
      })
    )
    // Mount-only animation sequence; SharedValues are stable refs and
    // onComplete is captured once for the splash lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const vLineStyle = useAnimatedStyle(() => ({
    height: vLineHeight.value,
    transform: [{ translateY: vLineTranslateY.value }],
    opacity: vLineOpacity.value,
  }))

  const dissolveStyle = useAnimatedStyle(() => ({
    opacity: dissolveOpacity.value,
  }))

  const textAnimStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value * textFadeOut.value,
    transform: [{ translateY: textTranslateY.value }],
  }))

  const containerAnimStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }))

  return (
    <Animated.View pointerEvents="none" style={[styles.container, containerAnimStyle]}>

      {/* Vertical line */}
      <Animated.View
        style={[
          styles.verticalLine,
          {
            left: nodeLeft + NODE_SIZE / 2 - VERTICAL_LINE_WIDTH / 2,
          },
          vLineStyle,
        ]}
      />

      {/* Thread lines group */}
      <View style={styles.threadGroup}>
        {/* Dissolve wrapper for lines + nodes */}
        <Animated.View style={dissolveStyle}>
          {THREAD_LINES.map((line, i) => (
            <ThreadLine
              key={i}
              index={i}
              widthPct={line.widthPct}
              color={line.color}
              nodeColor={line.nodeColor}
              nodeLeft={nodeLeft}
              lineLeft={lineLeft}
              screenWidth={screenWidth}
            />
          ))}
        </Animated.View>

        {/* Text */}
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <Animated.Text style={[styles.brandText, textAnimStyle]}>
          Threadbase
        </Animated.Text>

      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    zIndex: 9999,
  },
  verticalLine: {
    position: 'absolute',
    width: VERTICAL_LINE_WIDTH,
    backgroundColor: COLORS.blueMid,
    top: '40%',
  },
  threadGroup: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '40%',
  },
  threadRow: {
    justifyContent: 'center',
  },
  node: {
    position: 'absolute',
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 2,
  },
  line: {
    position: 'absolute',
    height: LINE_HEIGHT,
    borderRadius: LINE_HEIGHT / 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  brandText: {
    fontFamily: 'monospace',
    fontSize: 16,
    color: COLORS.text,
    letterSpacing: 3,
    textAlign: 'center',
    marginTop: 24,
  },
})
