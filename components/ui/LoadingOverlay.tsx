import React from 'react'
import { View, ActivityIndicator } from 'react-native'
import { dark } from '@/constants/theme'

interface Props {
  visible: boolean
}

export function LoadingOverlay({ visible }: Props) {
  if (!visible) return null
  return (
    <View
      className="absolute inset-0 items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(13, 17, 23, 0.7)' }}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    >
      <ActivityIndicator size="large" color={dark.text.accent} />
    </View>
  )
}
