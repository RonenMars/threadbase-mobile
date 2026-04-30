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
      style={[styles.fab, { bottom: 24 + insets.bottom }]}
      activeOpacity={0.85}
      accessibilityLabel="New session"
      accessibilityRole="button"
    >
      <Plus size={24} color="#000" weight="bold" />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#30d158',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
})
