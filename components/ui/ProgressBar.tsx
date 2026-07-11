import React, { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  loaded: number
  total: number
}

const BAR_HEIGHT = 3

export function ProgressBar({ loaded, total }: Props) {
  const theme = useTheme()
  const s = makeStyles(theme)

  const progress = total > 0 ? Math.min(loaded / total, 1) : 0
  const fill = useSharedValue(0)

  useEffect(() => {
    fill.value = withTiming(progress, { duration: 400 })
  }, [progress, fill])

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }))

  return (
    <View className="px-4 py-2" testID="conv-loading-progress">
      <View style={s.track}>
        <Animated.View style={[s.fill, fillStyle]} />
      </View>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    track: {
      height: BAR_HEIGHT,
      borderRadius: BAR_HEIGHT / 2,
      backgroundColor: theme.bg.card,
      overflow: 'hidden',
    },
    fill: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      borderRadius: BAR_HEIGHT / 2,
      backgroundColor: theme.text.accent,
    },
  })
}
