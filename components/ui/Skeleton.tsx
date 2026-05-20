import React, { useEffect, useRef } from 'react'
import { Animated, type DimensionValue, type ViewStyle } from 'react-native'
import { dark, radius } from '@/constants/theme'

type SkeletonBoxProps = {
  width?: DimensionValue
  height?: number
  borderRadius?: number
  style?: ViewStyle
}

export function SkeletonBox({ width = '100%', height = 14, borderRadius: br = radius.sm, style }: SkeletonBoxProps) {
  const anim = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.85, duration: 650, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.35, duration: 650, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [anim])

  return (
    <Animated.View
      style={[{ width, height, borderRadius: br, backgroundColor: dark.border, opacity: anim }, style]}
    />
  )
}
