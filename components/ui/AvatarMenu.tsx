import React from 'react'
import { TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { Gear } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/contexts/ThemeContext'

export function AvatarMenu() {
  const { t } = useTranslation('common')
  const router = useRouter()
  const theme = useTheme()

  return (
    <TouchableOpacity
      onPress={() => router.push('/settings')}
      className="w-8 h-8 items-center justify-center rounded-lg"
      accessibilityLabel={t('button.settings')}
      accessibilityRole="button"
      hitSlop={8}
    >
      <Gear size={22} color={theme.text.secondary} />
    </TouchableOpacity>
  )
}
