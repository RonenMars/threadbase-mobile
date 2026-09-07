import { unregisterPushToken } from '@/services/push'
import * as Notifications from 'expo-notifications'
import { createApiForServer } from '@/services/api-client'

jest.mock('@/services/api-client', () => ({
  createApiForServer: jest.fn(),
}))

const mockDelete = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  ;(createApiForServer as jest.Mock).mockReturnValue({ delete: mockDelete })
  ;(Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: 'ExpoTok[abc]' })
  mockDelete.mockResolvedValue(undefined)
})

describe('unregisterPushToken', () => {
  it('sends the token in the DELETE body, because a bodiless delete answers 400', async () => {
    await unregisterPushToken('srv-1')
    expect(createApiForServer).toHaveBeenCalledWith('srv-1')
    expect(mockDelete).toHaveBeenCalledWith('/api/push/register', { token: 'ExpoTok[abc]' })
  })

  it('resolves when the server is unreachable, so removal is never blocked', async () => {
    mockDelete.mockRejectedValue(new Error('Network request failed'))
    await expect(unregisterPushToken('srv-1')).resolves.toBeUndefined()
  })

  it('resolves when no push token exists, e.g. on a simulator', async () => {
    ;(Notifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValue(new Error('no token'))
    await expect(unregisterPushToken('srv-1')).resolves.toBeUndefined()
    expect(mockDelete).not.toHaveBeenCalled()
  })
})
