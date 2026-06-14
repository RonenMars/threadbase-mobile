import React from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  visible: boolean
}

export function LoadingOverlay({ visible }: Props) {
  const theme = useTheme()
  if (!visible) return null
  return (
    <View
      className="absolute inset-0 items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(13, 17, 23, 0.7)' }}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    >
      <ActivityIndicator size="large" color={theme.text.accent} />
    </View>
  )
}
