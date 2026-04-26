import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { useEffect } from 'react'
import { dark, font, radius, spacing } from '@/constants/theme'
import type { SessionStatus } from '@/types/api'

const STATUS_LABELS: Record<SessionStatus, string> = {
  running: 'Running',
  waiting_input: 'Waiting for Input',
  completed: 'Completed',
  failed: 'Failed',
  idle: 'Idle',
}

const STATUS_COLORS: Record<SessionStatus, string> = {
  running: dark.status.running,
  waiting_input: dark.status.waiting,
  completed: dark.status.completed,
  failed: dark.status.failed,
  idle: dark.status.idle,
}

interface Props {
  status: SessionStatus
}

export function SessionStatusBadge({ status }: Props) {
  const color = STATUS_COLORS[status] ?? dark.text.secondary
  const opacity = useSharedValue(1)

  useEffect(() => {
    if (status === 'waiting_input') {
      opacity.value = withRepeat(withTiming(0.3, { duration: 600 }), -1, true)
    } else {
      opacity.value = 1
    }
  }, [status, opacity])

  const dotStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <View style={styles.row}>
      <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle]} />
      <Text style={[styles.label, { color }]}>{STATUS_LABELS[status]}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
  },
  label: {
    fontSize: font.xs,
    fontWeight: '500',
  },
})
