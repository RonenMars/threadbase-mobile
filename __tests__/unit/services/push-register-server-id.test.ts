import { registerPushToken, registerPushTokenForAll } from '@/services/push'

const mockPost = jest.fn(async () => ({ ok: true }))
const mockApiFor = jest.fn((_serverId: string) => ({ post: mockPost }))

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[abc]' })),
}))

jest.mock('@/services/api-client', () => ({
  createApiForServer: (serverId: string) => mockApiFor(serverId),
}))

jest.mock('@/services/device-id', () => ({
  getDeviceClientId: jest.fn(async () => 'device-1'),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

// The same push token is registered with every paired server, and the push that
// comes back names no server of its own. Registering the id this app files each
// server under is what lets a tap open the server that sent it.
describe('push registration carries the app-side server id', () => {
  it('sends the id the app uses for that server', async () => {
    await registerPushToken('srv_aaa')

    expect(mockApiFor).toHaveBeenCalledWith('srv_aaa')
    expect(mockPost).toHaveBeenCalledWith(
      '/api/push/register',
      expect.objectContaining({ token: 'ExponentPushToken[abc]', serverId: 'srv_aaa' }),
    )
  })

  it('registers each server under its own id', async () => {
    await registerPushTokenForAll(['srv_aaa', 'srv_bbb'])

    const sent = mockApiFor.mock.calls.map(([id]) => id)
    const bodies = mockPost.mock.calls.map((c) => (c as unknown as [string, { serverId: string }])[1].serverId)
    expect(sent).toEqual(['srv_aaa', 'srv_bbb'])
    expect(bodies).toEqual(['srv_aaa', 'srv_bbb'])
  })
})
