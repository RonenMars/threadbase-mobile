import React, { useEffect } from 'react'
import { View, Text } from 'react-native'
import Animated, { useSharedValue, withTiming, useAnimatedStyle, interpolate } from 'react-native-reanimated'
import { CaretRight } from 'phosphor-react-native'
import { useThemedStyles } from '@/hooks/useThemedStyles'
import { useReduceMotion } from '@/hooks/useAccessibilitySettings'
import { makeStyles } from './CollapsibleCard.styles'

/** 3px status rail on the card's leading edge; null keeps the width but draws nothing. */
export function CardSpine({ color }: { color: string | null }) {
  const { styles } = useThemedStyles(makeStyles)
  return color ? <View style={[styles.spine, { backgroundColor: color }]} /> : <View style={styles.spinePlaceholder} />
}

export function CardTitleBlock({ parentLabel, title, activityLine }: { parentLabel?: string; title: string; activityLine?: string }) {
  const { styles } = useThemedStyles(makeStyles)
  return (
    <View style={styles.headerBody}>
      {parentLabel ? <Text style={styles.headerParent} numberOfLines={1}>{parentLabel}</Text> : null}
      <Text style={styles.headerSuffix} numberOfLines={1}>{title}</Text>
      {activityLine ? <Text style={styles.headerActivity} numberOfLines={1}>{activityLine}</Text> : null}
    </View>
  )
}

export function CountBadge({ count }: { count: number }) {
  const { styles } = useThemedStyles(makeStyles)
  return <Text style={styles.countBadge}>{count}</Text>
}

/** Caret that turns 90° (pointing down) when open; Reduce Motion snaps it. */
export function ChevronToggle({ isOpen }: { isOpen: boolean }) {
  const { theme } = useThemedStyles(makeStyles)
  const reduceMotion = useReduceMotion()
  const progress = useSharedValue(isOpen ? 1 : 0)
  useEffect(() => {
    // Reanimated shared value: assigning .value is its API.
    // eslint-disable-next-line react-hooks/immutability
    progress.value = withTiming(isOpen ? 1 : 0, { duration: reduceMotion ? 0 : 200 })
  }, [isOpen, reduceMotion, progress])
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(progress.value, [0, 1], [0, 90])}deg` }],
  }))
  return (
    <Animated.View style={style}>
      <CaretRight size={16} color={theme.text.secondary} />
    </Animated.View>
  )
}

export function CardBody({ children }: { children: React.ReactNode }) {
  const { styles } = useThemedStyles(makeStyles)
  return (
    <View style={styles.body}>
      <View style={styles.section}>{children}</View>
    </View>
  )
}
