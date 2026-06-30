import React from 'react'
import Animated, {
  useAnimatedStyle,
  SharedValue,
} from 'react-native-reanimated'

export const THREAD_LINES = [
  { widthPct: 0.30, color: '#79c0ff', nodeColor: '#79c0ff' },
  { widthPct: 0.24, color: '#58a6ff', nodeColor: '#58a6ff' },
  { widthPct: 0.20, color: '#58a6ff', nodeColor: '#58a6ff' },
  { widthPct: 0.25, color: 'rgba(88,166,255,0.4)', nodeColor: 'rgba(88,166,255,0.4)' },
  { widthPct: 0.33, color: '#f0883e', nodeColor: '#f0883e' },
] as const

export const LINE_GAP = 40

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

const GRADIENT_STOPS: { t: number; color: RGB }[] = [
  { t: 0.125, color: hexToRgb('#58a6ff') },   // blueMid
  { t: 0.375, color: hexToRgb('#79c0ff') },   // blueBright
  { t: 0.625, color: hexToRgb('#f5b483') },   // light orange
  { t: 0.875, color: hexToRgb('#f0883e') },   // orange
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

export interface MatrixChar {
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
export const MATRIX_RISE = 240

export const P5_DURATION = 2500

export function generateMatrixChars(
  screenWidth: number,
  nodeLeft: number,
  lineLeft: number,
): MatrixChar[] {
  const chars: MatrixChar[] = []
  let id = 0
  const spreadX = screenWidth * 0.4
  const offsetX = -screenWidth * 0.19

  const rainTop = -MATRIX_RISE
  const rainBottom = (THREAD_LINES.length - 1) * LINE_GAP
  const rainSpan = rainBottom - rainTop

  THREAD_LINES.forEach((line, lineIdx) => {
    const lineWidth = screenWidth * line.widthPct
    const count = Math.floor(lineWidth / 4)
    for (let c = 0; c < count; c++) {
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
        fadeRate: 0.38 + Math.random() * 0.08,
        size: 12 + Math.random() * 8,
        color: gradientColor(t),
        yOffset,
      })
    }
  })
  return chars
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

interface MatrixRainProps {
  matrixChars: MatrixChar[]
  matrixDownShift: number
  trigger: SharedValue<number>
  screenWidth: number
}

export function MatrixRain({ matrixChars, matrixDownShift, trigger, screenWidth }: MatrixRainProps) {
  return (
    <>
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
              trigger={trigger}
            />
          ))
      )}
    </>
  )
}
