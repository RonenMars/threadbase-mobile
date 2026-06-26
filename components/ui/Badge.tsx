import React from 'react'
import { Text, View } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/cn'

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
      className={cn(
        'rounded-full self-start',
        size === 'md' ? 'px-3 py-1' : 'px-2 py-0',
      )}
      style={{ backgroundColor: bg ?? theme.bg.card }}
    >
      <Text
        className={cn(
          'font-medium',
          size === 'md' ? 'text-font-sm' : 'text-font-xs',
        )}
        style={{ color: color ?? theme.text.secondary }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  )
}
