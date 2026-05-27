import React from 'react'
import { View, Text } from 'react-native'

interface EmptyStateProps {
  icon?: string
  title: string
  subtitle?: string
}

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  // Bug 24 — render a themed background so the themed text never lands on a
  // mismatched hardcoded `dark.bg.primary` parent. Without this, light-theme
  // users see Empty/Error states as effectively-invisible dark-on-dark text
  // when the surfacing screen still uses the hardcoded dark background.
  return (
    <View className="flex-1 items-center justify-center p-6 gap-2 bg-bg-primary">
      {icon ? <Text className="text-[40px] mb-2">{icon}</Text> : null}
      <Text className="text-text-primary text-font-lg font-semibold text-center">{title}</Text>
      {subtitle ? <Text className="text-text-secondary text-font-sm text-center">{subtitle}</Text> : null}
    </View>
  )
}
