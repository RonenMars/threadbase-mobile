import React, { useEffect, useState } from 'react'
import { StyleSheet, Switch, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { type Theme, font, spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import {
  serverSupportsPushSubscriptions,
  subscribeExternalSession,
  unsubscribeExternalSession,
} from '@/services/push'
import { useExternalSubscriptionsStore } from '@/stores/externalSubscriptions'

interface Props {
  serverId: string
  conversationId: string
}

type Note = 'noPermission' | 'failed' | null

/**
 * Subscribes this device to a push when an external session's turn ends. The
 * stored flag is a hint — the server keeps no list we can read and prunes a
 * subscription after 14 days idle — so opening the screen re-sends the PUT.
 */
export function ExternalSessionNotifyToggle({ serverId, conversationId }: Props) {
  const { t } = useTranslation('terminal')
  const theme = useTheme()
  const styles = makeStyles(theme)
  const supported = serverSupportsPushSubscriptions(serverId)
  const subscribed = useExternalSubscriptionsStore((s) => s.isSubscribed(serverId, conversationId))
  const setSubscribed = useExternalSubscriptionsStore((s) => s.setSubscribed)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Note>(null)

  useEffect(() => {
    if (!supported || !useExternalSubscriptionsStore.getState().isSubscribed(serverId, conversationId)) return
    subscribeExternalSession(serverId, conversationId).catch(() => {})
  }, [supported, serverId, conversationId])

  if (!supported) return null

  const onChange = async (on: boolean) => {
    setBusy(true)
    setNote(null)
    try {
      const sent = on
        ? await subscribeExternalSession(serverId, conversationId)
        : await unsubscribeExternalSession(serverId, conversationId)
      if (sent) setSubscribed(serverId, conversationId, on)
      else setNote('noPermission')
    } catch {
      setNote('failed')
    } finally {
      setBusy(false)
    }
  }

  let noteText: string | null = null
  switch (note) {
    case 'noPermission':
      noteText = t('session.notifyTurnEndNoPermission')
      break
    case 'failed':
      noteText = t('session.notifyTurnEndFailed')
      break
  }

  return (
    <View style={styles.row} testID="external-session-notify">
      <View style={styles.textBlock}>
        <Text style={styles.label}>{t('session.notifyTurnEnd')}</Text>
        {noteText ? (
          <Text style={styles.note} testID="external-session-notify-note">
            {noteText}
          </Text>
        ) : null}
      </View>
      <Switch
        value={subscribed}
        onValueChange={onChange}
        disabled={busy}
        trackColor={{ false: theme.border, true: theme.text.accent }}
        thumbColor="#fff"
        accessibilityLabel={t('session.notifyTurnEnd')}
        testID="external-session-notify-switch"
      />
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
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
    label: {
      color: theme.text.primary,
      fontSize: font.sm,
    },
    note: {
      color: theme.text.warning,
      fontSize: font.xs,
      lineHeight: 15,
    },
  })
}
