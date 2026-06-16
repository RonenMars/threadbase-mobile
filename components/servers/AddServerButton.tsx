import React from 'react'
import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import { Plus } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/contexts/ThemeContext'
import { font, spacing, radius, type Theme } from '@/constants/theme'

interface Props {
  onPress: () => void
}

export function AddServerButton({ onPress }: Props) {
  const theme = useTheme()
  const s = makeStyles(theme)
  const { t } = useTranslation('servers')

  return (
    <TouchableOpacity style={s.btn} onPress={onPress} activeOpacity={0.75} accessibilityLabel={t('manage.addServer')}>
      <Plus size={14} color={theme.text.accent} weight="bold" />
      <Text style={s.text}>{t('manage.addServer')}</Text>
    </TouchableOpacity>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      minHeight: 44,
    },
    text: {
      color: theme.text.accent,
      fontSize: font.base,
      fontWeight: '500',
    },
  })
}
