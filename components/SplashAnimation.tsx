import React, { useEffect } from 'react'
import { View, StyleSheet, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated'

const COLORS = {
  bg: '#0d1117',
  blueBright: '#79c0ff',
  blueMid: '#58a6ff',
  blueDim: 'rgba(88,166,255,0.4)',
  orange: '#f0883e',
  text: '#c9d1d9',
} as const

const THREAD_LINES = [
  { widthPct: 0.30, color: COLORS.blueBright, nodeColor: COLORS.blueBright },
  { widthPct: 0.24, color: COLORS.blueMid,    nodeColor: COLORS.blueMid },
  { widthPct: 0.20, color: COLORS.blueMid,    nodeColor: COLORS.blueMid },
  { widthPct: 0.25, color: COLORS.blueDim,    nodeColor: COLORS.blueDim },
  { widthPct: 0.33, color: COLORS.orange,     nodeColor: COLORS.orange },
] as const

const LINE_GAP = 40
const NODE_SIZE = 14
const LINE_HEIGHT = 4
const VERTICAL_LINE_WIDTH = 2

// Timing constants (ms)
const P1_DURATION = 700   // vertical line draw
const P2_START = 700      // when thread lines begin
const P2_STAGGER = 220    // gap between each line
const P2_LINE_DUR = 400   // each line draw duration
const P2_NODE_DUR = 350   // each node pop duration
const P3_START = 2000    // text fade-up
const P3_DURATION = 500  // text animation duration
const P4_START = 2500    // vertical line exit
const P4_DURATION = 500  // vertical line exit duration

const P5_START = 3000    // matrix rain + sweep bar start
const P5_DURATION = 2500 // matrix rain + sweep bar duration (extended by 0.5s)
const FADE_OUT_START = P5_START + P5_DURATION // final fade out starts right after phase 5
const FADE_OUT_DUR = 200   // fade out duration

const DIGITS = '0123456789'

type RGB = [number, number, number]

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ]
}

// 4 equally-sized gradient bands (25% each): blue, light blue, light orange,
// orange. Each color's stop is placed at the center of its 25% band; we
// interpolate linearly between neighboring stops for smooth transitions,
// and clamp outside the outermost stops so the edges stay on-color.
const GRADIENT_STOPS: { t: number; color: RGB }[] = [
  { t: 0.125, color: hexToRgb(COLORS.blueMid) },     // blue
  { t: 0.375, color: hexToRgb(COLORS.blueBright) },  // light blue
  { t: 0.625, color: hexToRgb('#f5b483') },          // light orange
  { t: 0.875, color: hexToRgb(COLORS.orange) },      // orange
]

function gradientColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t))
  const first = GRADIENT_STOPS[0]
  const last = GRADIENT_STOPS[GRADIENT_STOPS.length - 1]
  if (clamped <= first.t) {
    const [r, g, b] = first.color
    return `rgb(${r},${g},${b})`
  }
  if (clamped >= last.t) {
    const [r, g, b] = last.color
    return `rgb(${r},${g},${b})`
  }
  for (let i = 0; i < GRADIENT_STOPS.length - 1; i++) {
    const a = GRADIENT_STOPS[i]
    const b = GRADIENT_STOPS[i + 1]
    if (clamped >= a.t && clamped <= b.t) {
      const local = (clamped - a.t) / (b.t - a.t)
      const [r, g, bl] = lerpRgb(a.color, b.color, local)
      return `rgb(${r},${g},${bl})`
    }
  }
  const [r, g, b] = last.color
  return `rgb(${r},${g},${b})`
}

interface MatrixChar {
  id: number
  x: number
  y: number
  char: string
  speed: number
  delay: number
  fadeRate: number
  size: number
  color: string
  yOffset: number
}

// How far above the thread lines the rain column extends.
// Combined with the normal downward fall this makes the animation ~2x taller.
const MATRIX_RISE = 240


function generateMatrixChars(
  screenWidth: number,
  nodeLeft: number,
  lineLeft: number,
): MatrixChar[] {
  const chars: MatrixChar[] = []
  let id = 0
  const spreadX = screenWidth * 0.4 // extend x range well beyond thread lines
  const offsetX = -screenWidth * 0.19  // start further left

  // The effective start Y of a char ranges from -MATRIX_RISE (top of rain)
  // to (THREAD_LINES.length - 1) * LINE_GAP (bottom). We use this span to
  // color each char along a blue -> orange gradient.
  const rainTop = -MATRIX_RISE
  const rainBottom = (THREAD_LINES.length - 1) * LINE_GAP
  const rainSpan = rainBottom - rainTop

  THREAD_LINES.forEach((line, lineIdx) => {
    const lineWidth = screenWidth * line.widthPct
    // Doubled density: smaller divisor -> more numbers per line.
    const count = Math.floor(lineWidth / 4)
    for (let c = 0; c < count; c++) {
      // Distribute starting positions across a taller vertical range,
      // extending the rain upward above the thread lines.
      const yOffset = -Math.random() * MATRIX_RISE
      const effectiveY = lineIdx * LINE_GAP + yOffset
      const t = (effectiveY - rainTop) / rainSpan
      chars.push({
        id: id++,
        x: lineLeft + offsetX + (c / count) * (lineWidth + spreadX),
        y: 0,
        char: DIGITS[Math.floor(Math.random() * DIGITS.length)],
        speed: 40 + Math.random() * 80,
        delay: Math.random() * 250,
        // Tuned so every char fades to 0 within the phase but stays visible
        // almost all the way through (zero crossings around 1.95s - 2.37s,
        // matching the sweep bar's 2.5s duration).
        fadeRate: 0.38 + Math.random() * 0.08,
        size: 12 + Math.random() * 8,
        color: gradientColor(t),
        yOffset,
      })
    }
  })
  return chars
}

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

function MatrixCharacter({
  char,
  x,
  startY,
  yOffset,
  speed,
  delay,
  fadeRate,
  size,
  color,
  trigger,
}: {
  char: string
  x: number
  startY: number
  yOffset: number
  speed: number
  delay: number
  fadeRate: number
  size: number
  color: string
  trigger: SharedValue<number>
}) {
  const animStyle = useAnimatedStyle(() => {
    if (trigger.value === 0) {
      return { opacity: 0 }
    }
    const elapsed = trigger.value * P5_DURATION - delay
    if (elapsed < 0) {
      return {
        opacity: 0.9,
        transform: [{ translateY: 0 }],
      }
    }
    const t = elapsed / 1000
    const opacity = Math.max(0, 0.9 - t * fadeRate)
    return {
      opacity,
      transform: [{ translateY: speed * t }],
    }
  })

  return (
    <Animated.Text
      style={[
        {
          position: 'absolute',
          left: x,
          top: startY + yOffset,
          fontFamily: 'monospace',
          fontSize: size,
          color: color,
        },
        animStyle,
      ]}
    >
      {char}
    </Animated.Text>
  )
}

export function SplashAnimation({ onComplete }: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  // Keep the sweep bar visible below the notch / Dynamic Island on devices
  // like iPhone 17 Pro, with a small additional margin.
  const sweepBarTop = insets.top + 8
  const nodeLeft = screenWidth * 0.32
  const lineLeft = nodeLeft + NODE_SIZE / 2 + 8
  const totalHeight = (THREAD_LINES.length - 1) * LINE_GAP
  // Matrix rain starts at the vertical midpoint of the first third of the screen.
  // threadGroup is anchored at 40% screen height, so we shift up by the difference.
  const matrixDownShift = screenHeight / 2.5 - screenHeight * 0.4

  // Phase 1: vertical line
  const vLineHeight = useSharedValue(0)

  // Phase 3: text reveal
  const textOpacity = useSharedValue(0)
  const textTranslateY = useSharedValue(8)

  // Phase 4: vertical line exit
  const vLineTranslateY = useSharedValue(0)
  const vLineOpacity = useSharedValue(1)

  // Phase 5: matrix rain trigger (0 -> 1)
  const matrixProgress = useSharedValue(0)

  // Phase 5: dissolve thread lines and nodes
  const dissolveOpacity = useSharedValue(1)

  // Phase 3 text fade out
  const textFadeOut = useSharedValue(1)

  // Phase 6: sweep bar
  const barWidth = useSharedValue(0)

  // Final fade
  const containerOpacity = useSharedValue(1)

  // Generate matrix chars
  const matrixChars = React.useMemo(
    () => generateMatrixChars(screenWidth, nodeLeft, lineLeft),
    [screenWidth, nodeLeft, lineLeft]
  )

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

    // Phase 5: dissolve threads + start matrix
    dissolveOpacity.value = withDelay(
      P5_START,
      withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) })
    )
    textFadeOut.value = withDelay(
      P5_START,
      withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) })
    )
    matrixProgress.value = withDelay(
      P5_START,
      withTiming(1, { duration: P5_DURATION, easing: Easing.linear })
    )

    // Phase 6: sweep bar — same start, duration, and linear easing as the
    // matrix rain so their progress stays visually in sync across the phase.
    barWidth.value = withDelay(
      P5_START,
      withTiming(screenWidth, {
        duration: P5_DURATION,
        easing: Easing.linear,
      })
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

  const barStyle = useAnimatedStyle(() => ({
    width: barWidth.value,
    opacity: barWidth.value > 0 ? 1 : 0,
  }))

  const containerAnimStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }))

  return (
    <Animated.View pointerEvents="none" style={[styles.container, containerAnimStyle]}>
      {/* Sweep bar at top (offset below notch / Dynamic Island) */}
      <Animated.View style={[styles.sweepBar, { top: sweepBarTop }, barStyle]} />

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
        <Animated.Text style={[styles.brandText, textAnimStyle]}>
          threadbase
        </Animated.Text>

        {/* Matrix characters */}
        {THREAD_LINES.map((line, lineIdx) =>
          matrixChars
            .filter((_, i) => {
              const countPerLine = Math.floor((screenWidth * line.widthPct) / 8)
              const startIdx = THREAD_LINES.slice(0, lineIdx).reduce(
                (sum, l) => sum + Math.floor((screenWidth * l.widthPct) / 8), 0
              )
              return i >= startIdx && i < startIdx + countPerLine
            })
            .map((mc) => (
              <MatrixCharacter
                key={mc.id}
                char={mc.char}
                x={mc.x}
                startY={lineIdx * LINE_GAP + matrixDownShift}
                yOffset={mc.yOffset}
                speed={mc.speed}
                delay={mc.delay}
                fadeRate={mc.fadeRate}
                size={mc.size}
                color={mc.color}
                trigger={matrixProgress}
              />
            ))
        )}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    zIndex: 9999,
  },
  sweepBar: {
    position: 'absolute',
    left: 0,
    height: 4,
    backgroundColor: COLORS.blueBright,
    shadowColor: COLORS.blueBright,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 4,
    zIndex: 1,
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
