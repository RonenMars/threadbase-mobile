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
})
