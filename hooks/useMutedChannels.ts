import { useCallback, useEffect, useState } from 'react'
import { AppState, Linking, Platform } from 'react-native'
import * as Application from 'expo-application'
import * as Notifications from 'expo-notifications'

export type ChannelId = 'needs-you' | 'updates' | 'live-sessions'
const CHANNELS: readonly ChannelId[] = ['needs-you', 'updates', 'live-sessions']

/** Android channels the user has switched off in system settings; always empty elsewhere. */
export function useMutedChannels() {
  const [muted, setMuted] = useState<ChannelId[]>([])

  const refresh = useCallback(async () => {
    if (Platform.OS !== 'android') return
    const channels = await Promise.all(
      CHANNELS.map((id) => Notifications.getNotificationChannelAsync(id).catch(() => null)),
    )
    setMuted(
      CHANNELS.filter((_, i) => channels[i]?.importance === Notifications.AndroidImportance.NONE),
    )
  }, [])

  // Re-read on return from system settings, where the user just changed it.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh()
    })
    return () => sub.remove()
  }, [refresh])

  const openChannelSettings = useCallback((id: ChannelId) => {
    Linking.sendIntent('android.settings.CHANNEL_NOTIFICATION_SETTINGS', [
      { key: 'android.provider.extra.APP_PACKAGE', value: Application.applicationId ?? '' },
      { key: 'android.provider.extra.CHANNEL_ID', value: id },
    ]).catch(() => Linking.openSettings())
  }, [])

  return { muted, openChannelSettings }
}
