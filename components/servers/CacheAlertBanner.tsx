import React from 'react'
import { StyleSheet, Text, TouchableOpacity } from 'react-native'
import { WarningCircle } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { type Theme, font, spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useServersStore } from '@/stores/servers'

interface Props {
  onPress: () => void
}

export function CacheAlertBanner({ onPress }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { t } = useTranslation('servers')
  const servers = useServersStore((s) => s.servers)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const cacheAlert = useServersStore((s) => s.cacheAlert)

  const alertServerId = displayedServerIds.find((id) => cacheAlert[id]?.severity === 'low')
  const alert = alertServerId ? cacheAlert[alertServerId] : null

  if (!alert || !alertServerId) return null

  const serverLabel = servers[alertServerId]?.label || servers[alertServerId]?.url || alertServerId

  return (
    <TouchableOpacity
      style={styles.banner}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('cacheAlert.bannerTitle', { count: alert.missingCount, server: serverLabel })}
    >
      <WarningCircle size={18} color={theme.status.waiting} weight="fill" />
      <Text style={styles.title} numberOfLines={2}>
        {t('cacheAlert.bannerTitle', { count: alert.missingCount, server: serverLabel })}
      </Text>
    </TouchableOpacity>
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
    title: {
      flex: 1,
      color: theme.text.primary,
      fontSize: font.sm,
      lineHeight: 18,
    },
  })
}
