import React, { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { colors } from '../theme'

interface Props {
  count: number
  index: number
}

export function PagerDots({ count, index }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <Dot key={i} active={i === index} />
      ))}
    </View>
  )
}

function Dot({ active }: { active: boolean }) {
  const width = useSharedValue(active ? 22 : 6)
  const tint = useSharedValue(active ? 1 : 0)

  useEffect(() => {
    width.value = withTiming(active ? 22 : 6, { duration: 250 })
    tint.value = withTiming(active ? 1 : 0, { duration: 250 })
  }, [active, width, tint])

  const animStyle = useAnimatedStyle(() => ({
    width: width.value,
    backgroundColor: tint.value > 0.5 ? colors.blue400 : colors.ink6,
  }))

  return <Animated.View style={[styles.dot, animStyle]} />
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 4,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
})
