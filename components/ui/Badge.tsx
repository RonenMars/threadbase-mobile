import React from 'react'
import { Text, View } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { radius, spacing } from '@/constants/theme'

interface BadgeProps {
  label: string
  color?: string
  bg?: string
  size?: 'sm' | 'md'
}

export function Badge({ label, color, bg, size = 'sm' }: BadgeProps) {
  const theme = useTheme()
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderRadius: radius.sm,
        paddingHorizontal: spacing.xs - 1,
        paddingVertical: spacing.xs - 1,
        backgroundColor: bg ?? theme.bg.card,
      }}
    >
      <Text
        style={{
          color: color ?? theme.text.secondary,
          fontSize: size === 'md' ? 12 : 10,
          fontWeight: '600',
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  )
}
