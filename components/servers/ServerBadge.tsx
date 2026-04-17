import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { dark, font, radius, spacing } from '@/constants/theme'

/** Deterministic color from a serverId string. */
const BADGE_COLORS = ['#58a6ff', '#3fb950', '#d29922', '#f778ba', '#bc8cff', '#79c0ff']

function colorForServer(serverId: string): string {
  let hash = 0
  for (let i = 0; i < serverId.length; i++) {
    hash = ((hash << 5) - hash + serverId.charCodeAt(i)) | 0
  }
  return BADGE_COLORS[Math.abs(hash) % BADGE_COLORS.length]
}

interface Props {
  serverId: string
  label?: string
}

export function ServerBadge({ serverId, label }: Props) {
  const color = colorForServer(serverId)
  const displayLabel = label || serverId.slice(0, 8)

  return (
    <View style={[styles.badge, { backgroundColor: `${color}20` }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]} numberOfLines={1}>
        {displayLabel}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: font.xs,
    fontWeight: '500',
  },
})
