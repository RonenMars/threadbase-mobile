import { removeServerAndUnregisterPush } from '@/services/server-removal'

// The order of these two matters more than either on its own: the DELETE has to
// authenticate, and removeServer erases the credentials it would use.
const calls: string[] = []

jest.mock('@/services/push', () => ({
  unregisterPushToken: jest.fn(async () => {
    calls.push('unregister')
  }),
}))

const mockRemoveServer = jest.fn(async () => {
  calls.push('removeServer')
})

jest.mock('@/stores/servers', () => ({
  useServersStore: { getState: () => ({ removeServer: mockRemoveServer }) },
}))

beforeEach(() => {
  calls.length = 0
  jest.clearAllMocks()
})

describe('removeServerAndUnregisterPush', () => {
  it('unregisters the push token before the credentials it needs are erased', async () => {
    await removeServerAndUnregisterPush('srv_a')
    const { unregisterPushToken } = jest.requireMock('@/services/push')
    expect(unregisterPushToken).toHaveBeenCalledWith('srv_a')
    expect(mockRemoveServer).toHaveBeenCalledWith('srv_a')
    expect(calls).toEqual(['unregister', 'removeServer'])
  })

  it('still removes the server when the unregister rejects', async () => {
    const { unregisterPushToken } = jest.requireMock('@/services/push')
    ;(unregisterPushToken as jest.Mock).mockRejectedValueOnce(new Error('unreachable'))
    await expect(removeServerAndUnregisterPush('srv_a')).resolves.toBeUndefined()
    expect(mockRemoveServer).toHaveBeenCalledWith('srv_a')
  })
})
