import React from 'react'
import { TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { Gear } from 'phosphor-react-native'
import { dark } from '@/constants/theme'

export function AvatarMenu() {
  const router = useRouter()

  return (
    <TouchableOpacity
      onPress={() => router.push('/settings')}
      className="w-8 h-8 items-center justify-center rounded-lg"
      accessibilityLabel="Settings"
      accessibilityRole="button"
      hitSlop={8}
    >
      <Gear size={22} color={dark.text.secondary} />
    </TouchableOpacity>
  )
}
