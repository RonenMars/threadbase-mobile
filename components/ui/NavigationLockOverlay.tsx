import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useNavLockStore } from '@/stores/navLock'

export function NavigationLockOverlay() {
  const isNavigating = useNavLockStore((s) => s.isNavigating)
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { t } = useTranslation('common')

  if (!isNavigating) return null

  return (
    <View
      pointerEvents="auto"
      style={styles.scrim}
      accessibilityRole="progressbar"
      accessibilityLabel={t('navLock.opening')}
      testID="navigation-lock-overlay"
    >
      <View style={styles.card}>
        <ActivityIndicator color={theme.text.accent} />
        <Text style={styles.label}>{t('navLock.opening')}</Text>
      </View>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    scrim: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(13, 17, 23, 0.55)',
      zIndex: 100,
    },
    card: {
      backgroundColor: theme.bg.card,
      borderRadius: 16,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
      gap: spacing.sm,
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
    },
    label: {
      color: theme.text.secondary,
      fontSize: font.xs,
    },
  })
}
