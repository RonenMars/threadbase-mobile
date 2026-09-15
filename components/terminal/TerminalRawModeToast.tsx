import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { type Theme, font, spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

export function TerminalRawModeToast({ visible }: { visible: boolean }) {
  const { t } = useTranslation('terminal')
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  if (!visible) return null

  return (
    <View
      style={styles.banner}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      testID="terminal-raw-mode-note"
    >
      <Text style={styles.title}>{t('session.rawModeNote')}</Text>
      <Text style={styles.subtitle}>{t('session.rawModeDetails')}</Text>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    banner: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: theme.bg.secondary,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      gap: 1,
    },
    title: {
      color: theme.text.warning,
      fontSize: font.sm,
      fontWeight: '600',
    },
    subtitle: {
      color: theme.text.secondary,
      fontSize: font.xs,
      lineHeight: 15,
    },
  })
}
