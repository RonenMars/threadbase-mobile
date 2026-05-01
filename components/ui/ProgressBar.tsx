import React, { useEffect, useRef } from 'react'
import { View, Text, Animated } from 'react-native'

interface Props {
  loaded: number
  total: number
  label: string
  isCounting?: boolean
}

export function ProgressBar({ loaded, total, label, isCounting = false }: Props) {
  const animWidth = useRef(new Animated.Value(0)).current
  const progress = total > 0 ? Math.min(loaded / total, 1) : 0

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: progress,
      duration: 200,
      useNativeDriver: false,
    }).start()
  }, [progress])

  return (
    <View className="px-3 pt-4 pb-3 gap-2">
      <Text className="text-text-secondary text-font-sm text-center">
        {loaded.toLocaleString()} / {total.toLocaleString()} {label}
      </Text>
      <View className="h-1 bg-bg-card rounded-full overflow-hidden">
        <Animated.View
          className="h-full bg-text-accent rounded-full"
          style={{
            width: animWidth.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          }}
        />
      </View>
    </View>
  )
}
