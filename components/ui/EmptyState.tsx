import React from 'react'
import { View, Text } from 'react-native'

interface EmptyStateProps {
  icon?: string
  title: string
  subtitle?: string
}

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center p-6 gap-2">
      {icon ? <Text className="text-[40px] mb-2">{icon}</Text> : null}
      <Text className="text-text-primary text-font-lg font-semibold text-center">{title}</Text>
      {subtitle ? <Text className="text-text-secondary text-font-sm text-center">{subtitle}</Text> : null}
    </View>
  )
}
