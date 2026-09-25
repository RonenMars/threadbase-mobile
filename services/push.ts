import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { createApiForServer, NotFoundError } from './api-client'
import { getDeviceClientId } from './device-id'
import { toWirePrefs } from '@/lib/notification-prefs'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import type { PushRegisterPayload, PushTestResult } from '@/types/api'
import i18n from '@/lib/i18n'

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

/**
 * The notification feature this build registers with once it has set up what
 * the streamer's attention pushes name: the `needs-you` / `updates` Android
 * channels and the `permission` action category. A push naming a channel the
 * app never created is not displayed at all, so the streamer sends those fields
 * only to a token that lists the feature, and the feature is only listed once
 * setup has succeeded.
 */
export const ATTENTION_FEATURE = 'attention-v1'
export const ALLOW_ACTION = 'allow'
export const DENY_ACTION = 'deny'

let attentionSetup: { lang: string; done: Promise<boolean> } | null = null

/** Channel and button names are localized, so a language change sets them up again. */
export function ensureAttentionSetup(): Promise<boolean> {
  const lang = i18n.resolvedLanguage ?? i18n.language
  if (attentionSetup?.lang !== lang) attentionSetup = { lang, done: setUpAttention() }
  return attentionSetup.done
}

async function setUpAttention(): Promise<boolean> {
  try {
    // No-ops on iOS, which has no channels.
    await Notifications.setNotificationChannelAsync('needs-you', {
      name: i18n.t('settings:notification.channelNeedsYou'),
      importance: Notifications.AndroidImportance.HIGH,
      // Three short pulses: "the agent is blocked on you" can be told apart
      // from "finished" without looking at the phone.
      vibrationPattern: [0, 200, 120, 200, 120, 200],
    })
    await Notifications.setNotificationChannelAsync('updates', {
      name: i18n.t('settings:notification.channelUpdates'),
      importance: Notifications.AndroidImportance.DEFAULT,
    })
    // Both buttons open the app: on iOS an action that does not foreground it
    // never reaches JS once the app has been killed (expo-notifications 57).
    const options = { opensAppToForeground: true, isAuthenticationRequired: true }
    await Notifications.setNotificationCategoryAsync(
      'permission',
      [
        { identifier: ALLOW_ACTION, buttonTitle: i18n.t('settings:notification.actionAllow'), options },
        {
          identifier: DENY_ACTION,
          buttonTitle: i18n.t('settings:notification.actionDeny'),
          options: { ...options, isDestructive: true },
        },
      ],
      { previewPlaceholder: i18n.t('settings:notification.needsAnswer') },
    )
    return true
  } catch {
    // Retried on the next registration rather than remembered as failed.
    attentionSetup = null
    return false
  }
}

const answeredActions = new Set<string>()

/**
 * An Allow or Deny tap on a permission push: answer the gate it names, with the
 * `gateId` and option position the streamer put in `data`. Resolves whether an
 * answer was accepted; the caller opens the session either way, and a gate that
 * is still open shows its card there.
 *
 * Nothing is sent when the app's own biometric lock is on (a tap on the lock
 * screen is not the user unlocking this app), or when the push names a server
 * this app does not know.
 */
export async function answerFromNotification(
  response: Notifications.NotificationResponse,
  isKnownServer: (serverId: string) => boolean,
): Promise<boolean> {
  const action = response.actionIdentifier
  if (action !== ALLOW_ACTION && action !== DENY_ACTION) return false
  const data = response.notification.request.content.data as Record<string, unknown>
  const { sessionId, serverId, gateId } = data
  const position = action === ALLOW_ACTION ? data.allowOption : data.denyOption
  if (
    typeof sessionId !== 'string' ||
    typeof serverId !== 'string' ||
    typeof gateId !== 'string' ||
    typeof position !== 'string' ||
    !/^\d+$/.test(position) ||
    !isKnownServer(serverId) ||
    useSettingsStore.getState().biometricLock
  ) {
    return false
  }
  // The launch read-back and the warm listener can both see one tap.
  const key = `${response.notification.request.identifier}:${action}`
  if (answeredActions.has(key)) return false
  answeredActions.add(key)
  try {
    await createApiForServer(serverId).post(`/api/sessions/${sessionId}/permission/answer`, {
      gateId,
      optionIndex: Number(position),
    })
    return true
  } catch {
    // A gate that moved on answers 409; the session screen shows what is open now.
    return false
  }
}

export type RegisterPushResult =
  | { ok: true }
  | { ok: false; reason: 'permission_denied' | 'token_unavailable' }

export async function registerPushToken(serverId: string): Promise<RegisterPushResult> {
  // Never prompt from the registration path — onboarding owns the prompt.
  if (!(await hasPermission())) return { ok: false, reason: 'permission_denied' }

  // Only works on physical devices; silently skip on simulators
  let token: string
  try {
    const result = await Notifications.getExpoPushTokenAsync()
    token = result.data
  } catch {
    return { ok: false, reason: 'token_unavailable' }
  }

  const payload: PushRegisterPayload = {
    token,
    platform: Platform.OS as 'ios' | 'android',
    deviceId: await getDeviceClientId(),
    // The same token is registered with every paired server, and the push
    // arrives with no other hint of which one sent it. The streamer's own name
    // for itself is not a key we can look up.
    serverId,
    // The in-app choice, not the device's: the two differ when the user picks
    // a language in Settings, and the push should match the screen it opens.
    locale: i18n.resolvedLanguage ?? i18n.language,
    notificationPrefs: toWirePrefs(useSettingsStore.getState().notifications),
    ...((await ensureAttentionSetup()) && { notificationFeatures: [ATTENTION_FEATURE] }),
  }

  const api = createApiForServer(serverId)
  await api.post('/api/push/register', payload)
  return { ok: true }
}

/** Whether this server stores and enforces notification preferences. Older servers do neither. */
export function serverSupportsPushPrefs(serverId: string): boolean {
  return useServersStore.getState().servers[serverId]?.serverInfo?.push?.preferences === true
}

async function expoPushToken(): Promise<string | null> {
  if (!(await hasPermission())) return null
  try {
    return (await Notifications.getExpoPushTokenAsync()).data
  } catch {
    return null
  }
}

/**
 * Push the current preferences to one server.
 *
 * A PATCH rather than a re-register: registering resets the token's failure
 * streak and revocation, so toggling a switch through it would wipe the
 * delivery health the health screen shows. The server answers 404 for a token
 * it does not hold, and then the only way to get the preferences there is to
 * register with them.
 */
export async function syncNotificationPrefs(serverId: string): Promise<void> {
  if (!serverSupportsPushPrefs(serverId)) return
  const token = await expoPushToken()
  if (!token) return
  try {
    await createApiForServer(serverId).patch('/api/push/preferences', {
      token,
      prefs: toWirePrefs(useSettingsStore.getState().notifications),
    })
  } catch (err) {
    if (!(err instanceof NotFoundError)) throw err
    await registerPushToken(serverId)
  }
}

export async function syncNotificationPrefsForAll(serverIds: string[]): Promise<void> {
  await Promise.allSettled(serverIds.map((id) => syncNotificationPrefs(id)))
}

/**
 * A real push through the server and Expo to this device, ignoring the user's
 * preferences. `null` means it could not be attempted (no permission or token).
 */
export async function sendTestPush(serverId: string): Promise<PushTestResult | null> {
  const token = await expoPushToken()
  if (!token) return null
  return createApiForServer(serverId).post<PushTestResult>('/api/push/test', { token })
}

/**
 * Drop this device's push token from one server.
 *
 * Best-effort by design, and ordered before the credentials are erased: the
 * request has to authenticate, and a server is very often removed precisely
 * because it is unreachable. A failure here must never block the removal — the
 * streamer also expires tokens whose device is revoked, so the worst case is a
 * row that outlives the pairing rather than a removal the user cannot complete.
 */
export async function unregisterPushToken(serverId: string): Promise<void> {
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync()
    await createApiForServer(serverId).delete('/api/push/register', { token })
  } catch {
    // Unreachable server, revoked credentials, no token on a simulator — all
    // expected here, and none of them is a reason to keep the server.
  }
}

/** Register push token with all provided servers. */
export async function registerPushTokenForAll(serverIds: string[]): Promise<void> {
  await Promise.allSettled(serverIds.map((id) => registerPushToken(id)))
}
