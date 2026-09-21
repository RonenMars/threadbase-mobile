import * as Notifications from 'expo-notifications'
import { NotFoundError } from '@/services/api-client'
import {
  registerPushToken,
  sendTestPush,
  serverSupportsPushPrefs,
  syncNotificationPrefs,
} from '@/services/push'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'

/**
 * A preference change has to reach the server without going through register:
 * registering resets the token's failure streak, so a toggle would wipe the
 * delivery health the health screen shows. A 404 means the server does not hold
 * this token, and only registering can put the preferences there.
 */

const mockPost = jest.fn()
const mockPatch = jest.fn()

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}))

jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
  }),
  NotFoundError: class NotFoundError extends Error {},
}))

jest.mock('@/services/device-id', () => ({
  getDeviceClientId: jest.fn(async () => 'device-1'),
}))

const TOKEN = 'ExponentPushToken[abc]'

const SERVER_INFO = { version: '1', machineName: 'm', platform: 'darwin', activeSessions: 0 }

const pair = (push?: { preferences?: boolean }) =>
  useServersStore.setState({
    servers: {
      srv: {
        id: 'srv',
        url: 'http://s.local',
        apiKey: 'k',
        label: 's',
        isConnected: true,
        serverInfo: push ? { ...SERVER_INFO, push } : SERVER_INFO,
        connectionError: null,
      },
    },
    activeServerIds: ['srv'],
  })

beforeEach(() => {
  jest.clearAllMocks()
  ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true })
  ;(Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: TOKEN })
  mockPost.mockResolvedValue({})
  mockPatch.mockResolvedValue(undefined)
  useSettingsStore.setState({
    notifications: {
      waitingInput: false,
      sessionFailed: true,
      quietHoursEnabled: true,
      quietHoursFrom: '22:00',
      quietHoursTo: '08:00',
      quietHoursDays: {},
    },
  })
  pair({ preferences: true })
})

describe('registerPushToken', () => {
  it('sends the current preferences and the device time zone with the token', async () => {
    await registerPushToken('srv')

    const [path, payload] = mockPost.mock.calls[0]
    expect(path).toBe('/api/push/register')
    expect(payload.notificationPrefs).toEqual({
      waitingInput: false,
      sessionFailed: true,
      quietHours: {
        enabled: true,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        default: { from: '22:00', to: '08:00' },
      },
    })
  })
})

describe('serverSupportsPushPrefs', () => {
  it('reads support from the additive push.preferences field only', () => {
    expect(serverSupportsPushPrefs('srv')).toBe(true)
    pair({ preferences: false })
    expect(serverSupportsPushPrefs('srv')).toBe(false)
    pair(undefined)
    expect(serverSupportsPushPrefs('srv')).toBe(false)
    expect(serverSupportsPushPrefs('unknown')).toBe(false)
  })
})

describe('syncNotificationPrefs', () => {
  it('patches the preferences for this token on a server that enforces them', async () => {
    await syncNotificationPrefs('srv')

    expect(mockPatch).toHaveBeenCalledTimes(1)
    const [path, body] = mockPatch.mock.calls[0]
    expect(path).toBe('/api/push/preferences')
    expect(body.token).toBe(TOKEN)
    expect(body.prefs.waitingInput).toBe(false)
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('leaves an older server alone', async () => {
    pair(undefined)
    await syncNotificationPrefs('srv')
    expect(mockPatch).not.toHaveBeenCalled()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('does nothing without notification permission', async () => {
    ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false })
    await syncNotificationPrefs('srv')
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('registers with the preferences when the server does not know the token', async () => {
    mockPatch.mockRejectedValueOnce(new NotFoundError('/api/push/preferences'))
    await syncNotificationPrefs('srv')

    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost.mock.calls[0][0]).toBe('/api/push/register')
    expect(mockPost.mock.calls[0][1].notificationPrefs.waitingInput).toBe(false)
  })

  it('does not re-register for any other failure', async () => {
    mockPatch.mockRejectedValueOnce(new Error('network down'))
    await expect(syncNotificationPrefs('srv')).rejects.toThrow('network down')
    expect(mockPost).not.toHaveBeenCalled()
  })
})

describe('sendTestPush', () => {
  it('asks the server to push to this device and returns its verdict', async () => {
    const result = { ok: true, attempted: 1, succeeded: 1, state: 'healthy' }
    mockPost.mockResolvedValueOnce(result)

    await expect(sendTestPush('srv')).resolves.toEqual(result)
    expect(mockPost).toHaveBeenCalledWith('/api/push/test', { token: TOKEN })
  })

  it('returns null, sending nothing, when there is no token to test', async () => {
    ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false })
    await expect(sendTestPush('srv')).resolves.toBeNull()
    expect(mockPost).not.toHaveBeenCalled()
  })
})
