import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  visible: boolean
}

/** Full-screen spinner while a single-server install silently retries a query. */
export function RecoveryOverlay({ visible }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { t } = useTranslation('common')

  if (!visible) return null

  return (
    <View
      pointerEvents="auto"
      style={styles.scrim}
      accessibilityRole="progressbar"
      accessibilityLabel={t('recovery.title')}
      testID="recovery-overlay"
    >
      <View style={styles.card}>
        <ActivityIndicator size="large" color={theme.text.accent} />
        <Text style={styles.title}>{t('recovery.title')}</Text>
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
      zIndex: 50,
    },
    card: {
      backgroundColor: theme.bg.card,
      borderRadius: 16,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      gap: spacing.sm,
      minWidth: 200,
    },
    title: {
      color: theme.text.secondary,
      fontSize: font.sm,
    },
  })
}
