import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { deviceTimeZone } from '@/lib/notification-prefs'
import { syncNotificationPrefsForAll } from '@/services/push'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'

/**
 * Keep every paired server's copy of the notification preferences current.
 *
 * Registration already carries them, so this only covers what changes after:
 * an edit in Settings, and the phone moving to another time zone (quiet hours
 * are evaluated by the server in the zone the app last reported).
 */
export function useNotificationPrefsSync(): void {
  const notifications = useSettingsStore((s) => s.notifications)
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const synced = useRef({ notifications, zone: deviceTimeZone() })

  useEffect(() => {
    if (synced.current.notifications === notifications) return
    synced.current.notifications = notifications
    syncNotificationPrefsForAll(activeServerIds).catch(() => {})
  }, [notifications, activeServerIds])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      const zone = deviceTimeZone()
      if (zone === synced.current.zone) return
      synced.current.zone = zone
      syncNotificationPrefsForAll(useServersStore.getState().activeServerIds).catch(() => {})
    })
    return () => subscription.remove()
  }, [])
}
