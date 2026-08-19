import React from 'react'
import { Alert, StyleSheet, Switch, Text, View } from 'react-native'
import { ShieldWarning } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/contexts/ThemeContext'
import { font, spacing, type Theme } from '@/constants/theme'
import { IdentityFingerprintBlock } from '@/components/pair/IdentityFingerprintBlock'
import { formatFingerprint } from '@/services/e2ee/fingerprint'
import { useServersStore } from '@/stores/servers'

interface Props {
  serverId: string
}

/**
 * The `requireEncryption` pin, in Edit Server.
 *
 * Turning it on needs no confirmation — it only ever removes a way to be
 * downgraded. Turning it off does, and the confirmation names what stops being
 * true rather than asking whether the user is sure.
 */
export function ServerEncryptionSection({ serverId }: Props) {
  const { t } = useTranslation(['servers', 'pair'])
  const theme = useTheme()
  const styles = makeStyles(theme)

  const server = useServersStore((s) => s.servers[serverId])
  const setRequireEncryption = useServersStore((s) => s.setRequireEncryption)

  if (!server) return null

  const serverName = server.label ?? server.url
  const fingerprint = server.serverPublicKey
    ? formatFingerprint(server.serverPublicKey)
    : null
  const noIdentityTitle = t('pair:confirm.noSpkTitle')
  const noIdentityBody = t('pair:confirm.noSpkBody')

  function handleChange(on: boolean) {
    if (on) {
      setRequireEncryption(serverId, true)
      return
    }
    Alert.alert(t('encryption.clearTitle'), t('encryption.clearMessage', { server: serverName }), [
      { text: t('encryption.clearCancel'), style: 'cancel' },
      {
        text: t('encryption.clearConfirm'),
        style: 'destructive',
        onPress: () => setRequireEncryption(serverId, false),
      },
    ])
  }

  return (
    <View style={styles.wrap}>
      {fingerprint ? (
        <IdentityFingerprintBlock fingerprint={fingerprint} variant="settings" />
      ) : (
        <View style={styles.noIdentity} testID="server-no-identity">
          <View style={styles.noIdentityHeading}>
            <ShieldWarning size={18} color={theme.text.warning} weight="fill" />
            <Text style={styles.noIdentityTitle}>{noIdentityTitle}</Text>
          </View>
          <Text style={styles.noIdentityBody}>{noIdentityBody}</Text>
        </View>
      )}
      <View style={styles.row}>
        <View style={styles.textBlock}>
          <Text style={styles.label}>{t('encryption.requireLabel')}</Text>
          <Text style={styles.hint}>{t('encryption.requireHint')}</Text>
        </View>
        <Switch
          value={server.requireEncryption === true}
          onValueChange={handleChange}
          trackColor={{ false: theme.border, true: theme.text.accent }}
          thumbColor="#fff"
          testID="server-require-encryption"
        />
      </View>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    wrap: {
      gap: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    noIdentity: {
      gap: spacing.xs,
    },
    noIdentityHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    noIdentityTitle: {
      flex: 1,
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '700',
    },
    noIdentityBody: {
      color: theme.text.secondary,
      fontSize: font.sm,
      lineHeight: 18,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    textBlock: {
      flex: 1,
      gap: 2,
    },
    label: {
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
    },
    hint: {
      color: theme.text.secondary,
      fontSize: font.xs,
      lineHeight: 16,
    },
  })
}
