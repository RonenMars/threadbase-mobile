import * as Notifications from 'expo-notifications'
import { registerPushToken } from '@/services/push'

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: false })),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}))

jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({ post: jest.fn() }),
}))

jest.mock('@/services/device-id', () => ({
  getDeviceClientId: jest.fn(async () => 'device-1'),
}))

describe('registerPushToken result', () => {
  it('reports permission_denied when OS permission is off', async () => {
    const result = await registerPushToken('srv1')
    expect(result).toEqual({ ok: false, reason: 'permission_denied' })
  })

  it('reports token_unavailable and logs why when the push token cannot be fetched', async () => {
    ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: true })
    ;(Notifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValueOnce(
      new Error('Default FirebaseApp is not initialized')
    )
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await registerPushToken('srv1')

    expect(result).toEqual({ ok: false, reason: 'token_unavailable' })
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Default FirebaseApp is not initialized')
    )
    warn.mockRestore()
  })
})
