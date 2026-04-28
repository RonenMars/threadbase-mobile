import React, { useEffect, useRef } from 'react'
import { View, Text, Animated, StyleSheet } from 'react-native'
import { dark, font, radius, spacing } from '@/constants/theme'

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
    <View style={styles.container}>
      <Text style={styles.label}>
        {loaded.toLocaleString()} / {total.toLocaleString()} {label}
      </Text>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: animWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  label: {
    color: dark.text.secondary,
    fontSize: font.sm,
    textAlign: 'center',
  },
  track: {
    height: 4,
    backgroundColor: dark.bg.card,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: dark.text.accent,
    borderRadius: radius.full,
  },
})
