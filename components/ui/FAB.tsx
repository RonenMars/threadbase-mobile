import React from 'react'
import { TouchableOpacity, StyleSheet } from 'react-native'
import { Plus } from 'phosphor-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface Props {
  onPress: () => void
}

export function FAB({ onPress }: Props) {
  const insets = useSafeAreaInsets()
  return (
    <TouchableOpacity
      onPress={onPress}
      className="absolute right-4 w-14 h-14 rounded-full bg-[#1e7a3a] items-center justify-center"
      style={[styles.shadow, { bottom: 24 + insets.bottom }]}
      activeOpacity={0.85}
      accessibilityLabel="New session"
      accessibilityRole="button"
    >
      <Plus size={24} color="#000" weight="bold" />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
})
