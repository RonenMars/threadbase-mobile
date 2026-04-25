import React from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { dark } from '@/constants/theme'

interface Props {
  visible: boolean
}

export function LoadingOverlay({ visible }: Props) {
  if (!visible) return null
  return (
    <View style={styles.overlay} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <ActivityIndicator size="large" color={dark.text.accent} />
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 17, 23, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
})
