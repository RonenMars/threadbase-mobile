import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { api } from './api-client'
import type { PushRegisterPayload } from '@/types/api'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export async function requestPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  if (existingStatus === 'granted') return true

  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

export async function registerPushToken(serverUrl: string, apiKey: string): Promise<void> {
  const granted = await requestPermissions()
  if (!granted) return

  // Only works on physical devices; silently skip on simulators
  let token: string
  try {
    const result = await Notifications.getExpoPushTokenAsync()
    token = result.data
  } catch {
    return
  }

  const payload: PushRegisterPayload = {
    token,
    platform: Platform.OS as 'ios' | 'android',
  }

  await api.post('/api/push/register', payload)
}

export function isInQuietHours(from: string, to: string): boolean {
  const now = new Date()
  const [fromH, fromM] = from.split(':').map(Number)
  const [toH, toM] = to.split(':').map(Number)
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const fromMins = fromH * 60 + fromM
  const toMins = toH * 60 + toM

  if (fromMins <= toMins) {
    return nowMins >= fromMins && nowMins < toMins
  }
  // Wraps midnight
  return nowMins >= fromMins || nowMins < toMins
}
