import React from 'react'
import { TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Gear } from 'phosphor-react-native'
import { dark } from '@/constants/theme'

export function AvatarMenu() {
  const router = useRouter()

  return (
    <TouchableOpacity
      onPress={() => router.push('/settings')}
      style={styles.button}
      accessibilityLabel="Settings"
      accessibilityRole="button"
      hitSlop={8}
    >
      <Gear size={22} color={dark.text.secondary} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
})
