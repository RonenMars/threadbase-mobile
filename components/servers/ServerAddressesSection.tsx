import React, { useCallback, useSyncExternalStore } from 'react'
import { StyleSheet, Switch, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useTheme } from '@/contexts/ThemeContext'
import { font, spacing, type Theme } from '@/constants/theme'
import { useServersStore } from '@/stores/servers'
import { serverAddresses } from '@/services/server-addresses'
import { wsManager } from '@/services/ws-client'

interface Props {
  serverId: string
}

type LiveAddress = 'yours' | 'public' | 'relay' | 'none'

const subscribeToSockets = (onChange: () => void) => wsManager.onAnyStatusChange(onChange)

function liveAddressLabel(live: LiveAddress, t: TFunction<'servers'>) {
  switch (live) {
    case 'yours':
      return t('addresses.viaYours')
    case 'public':
      return t('addresses.viaPublic')
    case 'relay':
      return t('addresses.viaRelay')
    case 'none':
      return t('addresses.notConnected')
  }
}

/**
 * A server's other addresses and which one the live connection is on (#734).
 * Hidden when the server has nothing but the user's own address to dial — none
 * advertised and no relay route, or not pinned (see `serverAddresses`).
 */
export function ServerAddressesSection({ serverId }: Props) {
  const { t } = useTranslation('servers')
  const theme = useTheme()
  const styles = makeStyles(theme)
  const server = useServersStore((s) => s.servers[serverId])
  const liveUrl = useSyncExternalStore(
    subscribeToSockets,
    useCallback(() => wsManager.liveUrl(serverId), [serverId]),
  )

  const setRelayDisabled = useServersStore((s) => s.setRelayDisabled)

  if (!server) return null
  const addresses = serverAddresses(server)
  // Asked with the relay allowed, so the switch stays on screen after it is
  // turned off — otherwise switching it off would remove the way back.
  const relayUrl = serverAddresses({ ...server, publicUrl: undefined, relayDisabled: false })[1]
  if (addresses.length < 2 && !relayUrl) return null

  const publicUrl = addresses.find((address, i) => i > 0 && address !== relayUrl)
  let live: LiveAddress = 'none'
  if (liveUrl === addresses[0]) live = 'yours'
  else if (liveUrl && liveUrl === publicUrl) live = 'public'
  else if (liveUrl && liveUrl === relayUrl) live = 'relay'

  return (
    <View style={styles.wrap} testID="server-addresses">
      {publicUrl ? (
        <View style={styles.textBlock}>
          <Text style={styles.label}>{t('addresses.publicLabel')}</Text>
          <Text style={styles.value} numberOfLines={1}>{publicUrl}</Text>
        </View>
      ) : null}
      {relayUrl ? (
        <View style={styles.row}>
          <View style={[styles.textBlock, styles.grow]}>
            <Text style={styles.label}>{t('addresses.relayLabel')}</Text>
            <Text style={styles.value} numberOfLines={1}>{relayHost(relayUrl)}</Text>
          </View>
          <Switch
            value={server.relayDisabled !== true}
            onValueChange={(allowed) => setRelayDisabled(serverId, !allowed)}
            trackColor={{ false: theme.border, true: theme.text.accent }}
            thumbColor={theme.colorMode === 'light' ? theme.bg.card : '#fff'}
            accessibilityLabel={t('addresses.relayLabel')}
            testID="server-addresses-relay-toggle"
          />
        </View>
      ) : null}
      {addresses.length > 1 ? (
        <View style={styles.textBlock}>
          <Text style={styles.label}>{t('addresses.liveLabel')}</Text>
          <Text style={styles.value} testID="server-addresses-live">{liveAddressLabel(live, t)}</Text>
        </View>
      ) : null}
      {publicUrl ? <Text style={styles.hint}>{t('addresses.hint')}</Text> : null}
      {relayUrl ? <Text style={styles.hint}>{t('addresses.relayHint')}</Text> : null}
    </View>
  )
}

/** The route id after the host identifies a tunnel and means nothing to a reader. */
function relayHost(relayUrl: string): string {
  return relayUrl.replace(/^https?:\/\//i, '').replace(/\/.*$/, '')
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    wrap: {
      gap: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    textBlock: {
      gap: 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    grow: {
      flex: 1,
    },
    label: {
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
    },
    value: {
      color: theme.text.secondary,
      fontSize: font.sm,
    },
    hint: {
      color: theme.text.secondary,
      fontSize: font.xs,
      lineHeight: 16,
    },
  })
}
