import React, { useEffect, useMemo, useState } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/contexts/ThemeContext'
import { useReduceMotion } from '@/hooks/useAccessibilitySettings'
import type { Theme } from '@/constants/theme'

const TRAIL = 2.6
const UNLIT = 0.14
const CYCLE_MS = 1050

const SIZES = {
  compact: { count: 7, width: 5, height: 5, gap: 2, padH: 6, padV: 3 },
  banner: { count: 11, width: 8, height: 7, gap: 3, padH: 8, padV: 4 },
} as const

export type KnightRiderSize = keyof typeof SIZES

interface Props {
  testID?: string
  size?: KnightRiderSize
  /** Overrides the default "cached data" announcement for non-sync uses (e.g. the working footer). */
  accessibilityLabel?: string
}

function scannerPalette(theme: Theme): string[] {
  return [
    theme.status.running,
    theme.text.accent,
    theme.status.waiting,
    theme.text.highlight,
    theme.status.completed,
  ]
}

export function KnightRiderScanner({ testID, size = 'compact', accessibilityLabel }: Props) {
  const theme = useTheme()
  const { t } = useTranslation('sessions')
  const [progress] = useState(() => new Animated.Value(0))
  const reduceMotion = useReduceMotion()
  const spec = SIZES[size]
  const colors = scannerPalette(theme)

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(0)
      return
    }
    const sweep = (toValue: number) =>
      Animated.timing(progress, {
        toValue,
        duration: CYCLE_MS,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      })
    const loop = Animated.loop(Animated.sequence([sweep(1), sweep(0)]))
    loop.start()
    return () => loop.stop()
  }, [progress, reduceMotion])

  return (
    <View
      style={[
        styles.track,
        {
          gap: spec.gap,
          paddingHorizontal: spec.padH,
          paddingVertical: spec.padV,
          backgroundColor: theme.bg.card,
          borderColor: theme.border,
        },
      ]}
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? t('sync.cachedData')}
      accessibilityState={{ busy: true }}
      pointerEvents="none"
    >
      {Array.from({ length: spec.count }, (_, i) => (
        <ScannerSegment
          key={i}
          index={i}
          count={spec.count}
          progress={progress}
          color={colors[i % colors.length]}
          width={spec.width}
          height={spec.height}
        />
      ))}
    </View>
  )
}

// The native driver takes numbers, not worklets, so the glow curve is sampled
// into an interpolation instead of recomputed per frame. It is piecewise linear
// in `progress`, so SAMPLES points reproduce it; the alternative is a Reanimated
// worklet, which commits the whole shadow tree on every one of those frames.
const SAMPLES = 21

function ScannerSegment({
  index,
  count,
  progress,
  color,
  width,
  height,
}: {
  index: number
  count: number
  progress: Animated.Value
  color: string
  width: number
  height: number
}) {
  const { opacity, scaleY } = useMemo(() => {
    const inputRange: number[] = []
    const glow: number[] = []
    const scale: number[] = []
    for (let s = 0; s < SAMPLES; s++) {
      const p = s / (SAMPLES - 1)
      const dist = Math.abs(index - p * (count - 1))
      inputRange.push(p)
      glow.push(Math.max(UNLIT, 1 - dist / TRAIL))
      scale.push(1 + Math.max(0, 1 - dist) * 0.2)
    }
    return {
      opacity: progress.interpolate({ inputRange, outputRange: glow }),
      scaleY: progress.interpolate({ inputRange, outputRange: scale }),
    }
  }, [index, count, progress])

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: height / 2,
          backgroundColor: color,
        },
        { opacity, transform: [{ scaleY }] },
      ]}
    />
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
  },
})
