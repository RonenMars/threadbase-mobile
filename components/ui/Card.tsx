import React from 'react'
import { View } from 'react-native'
import type { ViewStyle } from 'react-native'
import { cn } from '@/lib/cn'
import { useIsGlass } from '@/contexts/ThemeContext'
import { GlassCard } from './GlassCard'

interface CardProps {
  children: React.ReactNode
  style?: ViewStyle
  variant?: 'default' | 'warning' | 'danger'
  testID?: string
}

const VARIANT_CLASS: Record<NonNullable<CardProps['variant']>, string> = {
  default: '',
  warning:  'border-status-waiting',
  danger:   'border-status-failed',
}

export function Card({ children, style, variant = 'default', testID }: CardProps) {
  const isGlass = useIsGlass()
  if (isGlass) {
    return (
      <GlassCard style={style} variant={variant} testID={testID}>
        {children}
      </GlassCard>
    )
  }

  return (
    <View
      testID={testID}
      className={cn(
        'bg-bg-card rounded-radius-md p-3 border border-border mb-2 gap-1',
        VARIANT_CLASS[variant],
      )}
      style={style}
    >
      {children}
    </View>
  )
}
