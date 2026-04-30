import React from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import { useEffect } from 'react'
import { dark, font, radius, spacing } from '@/constants/theme'
import type { SessionStatus } from '@/types/api'

const STATUS_LABELS: Partial<Record<SessionStatus, string>> = {
  running: 'Running',
  idle: 'Idle',
}

const STATUS_COLORS: Partial<Record<SessionStatus, string>> = {
  running: dark.status.running,
  idle: dark.status.idle,
}

interface Props {
  status: SessionStatus
  isRefetching?: boolean
}

export function SessionStatusBadge({ status, isRefetching }: Props) {
  const color = STATUS_COLORS[status] ?? dark.status.idle
  const opacity = useSharedValue(1)

  useEffect(() => {
    opacity.value = 1
  }, [status, opacity])

  const dotStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <View style={styles.row}>
      {isRefetching ? (
        <ActivityIndicator size="small" color={color} style={styles.spinner} />
      ) : (
        <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle]} />
      )}
      <Text style={[styles.label, { color }]}>{STATUS_LABELS[status] ?? 'Idle'}</Text>
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
  spinner: {
    transform: [{ scale: 0.6 }],
  },
  label: {
    fontSize: font.xs,
    fontWeight: '500',
  },
})
