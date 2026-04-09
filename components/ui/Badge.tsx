import React from 'react'
import { Text, View, StyleSheet } from 'react-native'
import { dark, font, radius, spacing } from '@/constants/theme'

interface BadgeProps {
  label: string
  color?: string
  bg?: string
  size?: 'sm' | 'md'
}

export function Badge({ label, color = dark.text.secondary, bg = dark.bg.card, size = 'sm' }: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }, size === 'md' && styles.badgeMd]}>
      <Text style={[styles.text, { color }, size === 'md' && styles.textMd]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  badgeMd: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  text: {
    fontSize: font.xs,
    fontWeight: '500',
  },
  textMd: {
    fontSize: font.sm,
  },
})
