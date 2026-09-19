import i18n from '@/lib/i18n'
import { registerPushToken } from '@/services/push'

// The streamer writes each notification in the language the registration
// carries, so it has to be the in-app choice rather than the device's.

const mockPost = jest.fn()

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[x]' })),
}))

jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({ post: mockPost }),
}))

jest.mock('@/services/device-id', () => ({
  getDeviceClientId: jest.fn(async () => 'device-1'),
}))

describe('registerPushToken locale', () => {
  afterEach(async () => {
    mockPost.mockClear()
    await i18n.changeLanguage('en')
  })

  it('sends the language the app is displaying', async () => {
    await i18n.changeLanguage('he')

    await registerPushToken('srv1')

    expect(mockPost).toHaveBeenCalledWith(
      '/api/push/register',
      expect.objectContaining({ token: 'ExponentPushToken[x]', locale: 'he' }),
    )
  })
})
