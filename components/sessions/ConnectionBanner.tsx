import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { CellSignalSlash } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { type Theme, font, spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  /**
   * 'reconnecting' — the WS is not connected; on-screen content is frozen.
   * 'stalled' — WS says connected but no terminal frame has arrived in a
   * while (half-dead socket); subtler styling.
   */
  variant: 'reconnecting' | 'stalled'
}

// Slim inline strip (ServerErrorBanner precedent) — a persistent connection
// indicator must not block the content the way the modal-style Banner does.
export function ConnectionBanner({ variant }: Props) {
  const { t } = useTranslation('terminal')
  const theme = useTheme()
  const styles = makeStyles(theme)

  const isReconnecting = variant === 'reconnecting'
  const accent = isReconnecting ? theme.text.warning : theme.text.secondary
  const title = isReconnecting
    ? t('connection.reconnectingTitle')
    : t('connection.stalledTitle')
  const message = isReconnecting
    ? t('connection.reconnectingMessage')
    : t('connection.stalledMessage')

  return (
    <View style={styles.banner} accessibilityRole="alert" testID={`connection-banner-${variant}`}>
      {isReconnecting ? (
        <ActivityIndicator size="small" color={accent} />
      ) : (
        <CellSignalSlash size={16} color={accent} />
      )}
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: accent }]}>{title}</Text>
        <Text style={styles.subtitle}>{message}</Text>
      </View>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: theme.bg.secondary,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    textBlock: {
      flex: 1,
      gap: 1,
    },
    title: {
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
