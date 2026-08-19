import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { CaretLeft } from 'phosphor-react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { goBackOrHub } from '@/lib/goBackOrHub'

interface Props {
  title?: string
  titleRight?: React.ReactNode
  right?: React.ReactNode
  onBack?: () => void
}

export function ScreenHeader({ title, titleRight, right, onBack }: Props) {
  const router = useRouter()
  const { t } = useTranslation('common')
  const theme = useTheme()
  const styles = makeStyles(theme)
  return (
    <View style={styles.bar}>
      <Pressable
        testID="screen-header-back-button"
        onPress={onBack ?? (() => goBackOrHub(router))}
        hitSlop={16}
        style={({ pressed }) => [styles.side, { opacity: pressed ? 0.5 : 1 }]}
        accessibilityLabel={t('button.back')}
      >
        <CaretLeft size={28} color={theme.text.primary} />
      </Pressable>
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={1}>{title ?? ''}</Text>
        {titleRight ?? null}
      </View>
      <View style={styles.side}>{right ?? null}</View>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.bg.primary,
      height: 52,
      paddingHorizontal: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    side: {
      minWidth: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    titleRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    title: {
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
      flexShrink: 1,
    },
  })
}
