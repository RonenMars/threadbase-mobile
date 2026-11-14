import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Warning } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/contexts/ThemeContext'
import { font, spacing, type Theme } from '@/constants/theme'

/** Shown where this browser keeps, or would keep, a wrapped device key (docs/e2ee-client.md). */
export function WrappedKeyWarning() {
  const { t } = useTranslation('servers')
  const theme = useTheme()
  const styles = makeStyles(theme)
  const title = t('encryption.wrappedKeyTitle')
  const body = t('encryption.wrappedKeyBody')

  return (
    <View style={styles.wrap} testID="wrapped-key-warning">
      <View style={styles.heading}>
        <Warning size={18} color={theme.text.warning} weight="fill" />
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.body}>{body}</Text>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    wrap: {
      gap: spacing.xs,
    },
    heading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    title: {
      flex: 1,
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '700',
    },
    body: {
      color: theme.text.secondary,
      fontSize: font.sm,
      lineHeight: 18,
    },
  })
}
