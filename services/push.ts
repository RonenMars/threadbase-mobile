import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { createApiForServer } from './api-client'
import { getDeviceClientId } from './device-id'
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
  const { granted } = await Notifications.getPermissionsAsync()
  if (granted) return true

  const result = await Notifications.requestPermissionsAsync()
  return result.granted
}

async function hasPermission(): Promise<boolean> {
  const { granted } = await Notifications.getPermissionsAsync()
  return granted
}

export async function registerPushToken(serverId: string): Promise<void> {
  // Never prompt from the registration path — onboarding owns the prompt.
  if (!(await hasPermission())) return

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
    deviceId: await getDeviceClientId(),
  }

  const api = createApiForServer(serverId)
  await api.post('/api/push/register', payload)
}

/** Register push token with all provided servers. */
export async function registerPushTokenForAll(serverIds: string[]): Promise<void> {
  await Promise.allSettled(serverIds.map((id) => registerPushToken(id)))
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
