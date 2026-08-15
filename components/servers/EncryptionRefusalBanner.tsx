import React from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { LockKeyOpen } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/contexts/ThemeContext'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useServersStore } from '@/stores/servers'
import { encryptionPinRefuses } from '@/types/api'

/**
 * Shown when a displayed server is pinned to encryption and is not offering
 * any. There is deliberately no "connect anyway": the pin is the whole
 * mechanism, and an escape hatch on the refusal screen is the one thing an
 * attacker who stripped the capability would need the user to tap.
 */
export function EncryptionRefusalBanner() {
  const { t } = useTranslation('servers')
  const theme = useTheme()
  const styles = makeStyles(theme)

  const servers = useServersStore((s) => s.servers)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const refreshServerInfo = useServersStore((s) => s.refreshServerInfo)
  const removeServer = useServersStore((s) => s.removeServer)

  const refusedId = displayedServerIds.find((id) => {
    const server = servers[id]
    return server ? encryptionPinRefuses(server) : false
  })
  if (!refusedId) return null

  const refused = servers[refusedId]
  const serverName = refused.label ?? refused.url

  function handleForget(serverId: string) {
    Alert.alert(
      t('encryption.forgetTitle', { server: serverName }),
      t('encryption.forgetMessage', { server: serverName }),
      [
        { text: t('encryption.forgetCancel'), style: 'cancel' },
        {
          text: t('encryption.forgetConfirm'),
          style: 'destructive',
          onPress: () => { void removeServer(serverId) },
        },
      ],
    )
  }

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <View style={styles.iconAndText}>
        <LockKeyOpen size={16} color={theme.text.danger} weight="fill" />
        <View style={styles.textBlock}>
          <Text style={styles.title}>{t('encryption.refusedTitle', { server: serverName })}</Text>
          <Text style={styles.subtitle}>{t('encryption.refusedBody')}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={styles.action}
          onPress={() => { void refreshServerInfo(refusedId) }}
          accessibilityRole="button"
          testID="encryption-refusal-retry"
        >
          <Text style={styles.actionText}>{t('encryption.refusedRetry')}</Text>
        </Pressable>
        <Pressable
          style={styles.action}
          onPress={() => handleForget(refusedId)}
          accessibilityRole="button"
          testID="encryption-refusal-forget"
        >
          <Text style={styles.actionDangerText}>{t('encryption.refusedForget')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    banner: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm + 2,
      paddingBottom: spacing.md,
      backgroundColor: theme.bg.secondary,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      gap: spacing.sm,
    },
    iconAndText: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.xs,
    },
    textBlock: {
      flex: 1,
      gap: 2,
    },
    title: {
      color: theme.text.danger,
      fontSize: font.base,
      fontWeight: '600',
    },
    subtitle: {
      color: theme.text.secondary,
      fontSize: font.xs,
      lineHeight: 16,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    action: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      minHeight: 32,
      justifyContent: 'center',
    },
    actionText: {
      color: theme.text.primary,
      fontSize: font.xs,
      fontWeight: '600',
    },
    actionDangerText: {
      color: theme.text.danger,
      fontSize: font.xs,
      fontWeight: '600',
    },
  })
}
