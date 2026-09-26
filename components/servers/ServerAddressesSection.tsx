import React, { useCallback, useSyncExternalStore } from 'react'
import { StyleSheet, Text, View } from 'react-native'
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

type LiveAddress = 'yours' | 'public' | 'none'

const subscribeToSockets = (onChange: () => void) => wsManager.onAnyStatusChange(onChange)

function liveAddressLabel(live: LiveAddress, t: TFunction<'servers'>) {
  switch (live) {
    case 'yours':
      return t('addresses.viaYours')
    case 'public':
      return t('addresses.viaPublic')
    case 'none':
      return t('addresses.notConnected')
  }
}

/**
 * A server's second address and which one the live connection is on (#734).
 * Hidden when the server has no second address to dial — none advertised, or
 * not pinned (see `serverAddresses`).
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

  if (!server) return null
  const addresses = serverAddresses(server)
  if (addresses.length < 2) return null

  const live: LiveAddress = liveUrl === addresses[0] ? 'yours' : liveUrl === addresses[1] ? 'public' : 'none'

  return (
    <View style={styles.wrap} testID="server-addresses">
      <View style={styles.textBlock}>
        <Text style={styles.label}>{t('addresses.publicLabel')}</Text>
        <Text style={styles.value} numberOfLines={1}>{addresses[1]}</Text>
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.label}>{t('addresses.liveLabel')}</Text>
        <Text style={styles.value} testID="server-addresses-live">{liveAddressLabel(live, t)}</Text>
      </View>
      <Text style={styles.hint}>{t('addresses.hint')}</Text>
    </View>
  )
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
