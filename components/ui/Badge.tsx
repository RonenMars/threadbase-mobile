import React from 'react'
import { Text, View } from 'react-native'
import { dark } from '@/constants/theme'
import { cn } from '@/lib/cn'

interface BadgeProps {
  label: string
  color?: string
  bg?: string
  size?: 'sm' | 'md'
}

export function Badge({ label, color = dark.text.secondary, bg = dark.bg.card, size = 'sm' }: BadgeProps) {
  return (
    <View
      className={cn(
        'rounded-full px-2 self-start',
        size === 'md' ? 'py-1 px-3' : 'py-0',
      )}
      style={{ backgroundColor: bg }}
    >
      <Text
        className={cn(
          'font-medium',
          size === 'md' ? 'text-font-sm' : 'text-font-xs',
        )}
        style={{ color }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  )
}
