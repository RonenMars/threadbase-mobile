import React, { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/contexts/ThemeContext'
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
  const progress = useSharedValue(0)
  const spec = SIZES[size]
  const colors = scannerPalette(theme)

  useEffect(() => {
    progress.value = 0
    progress.value = withRepeat(
      withTiming(1, { duration: CYCLE_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(progress)
  }, [progress])

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
  progress: SharedValue<number>
  color: string
  width: number
  height: number
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const head = progress.value * (count - 1)
    const dist = Math.abs(index - head)
    const glow = Math.max(UNLIT, 1 - dist / TRAIL)
    const scaleY = 1 + Math.max(0, 1 - dist) * 0.2
    return {
      opacity: glow,
      transform: [{ scaleY }],
    }
  })

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: height / 2,
          backgroundColor: color,
        },
        animatedStyle,
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
