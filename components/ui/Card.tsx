import React from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'
import { dark, radius, spacing } from '@/constants/theme'

interface CardProps {
  children: React.ReactNode
  style?: ViewStyle
  variant?: 'default' | 'warning' | 'danger'
}

export function Card({ children, style, variant = 'default' }: CardProps) {
  return (
    <View style={[styles.card, variantStyles[variant], style]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: dark.border,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
})

const variantStyles = StyleSheet.create({
  default: {},
  warning: { borderColor: dark.status.waiting },
  danger: { borderColor: dark.status.failed },
})
