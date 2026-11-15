import * as Notifications from 'expo-notifications'
import { NotFoundError } from '@/services/api-client'
import {
  serverSupportsPushSubscriptions,
  subscribeExternalSession,
  unsubscribeExternalSession,
} from '@/services/push'
import { useServersStore } from '@/stores/servers'

/**
 * The streamer holds one subscription per token + external session and answers
 * 404 TOKEN_NOT_FOUND when it does not know the token, so the PUT re-registers
 * and retries once. There is no list endpoint; the local flag is only a hint.
 */

const mockPost = jest.fn()
const mockPut = jest.fn()
const mockDelete = jest.fn()

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}))

jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  }),
  NotFoundError: class NotFoundError extends Error {},
}))

jest.mock('@/services/device-id', () => ({
  getDeviceClientId: jest.fn(async () => 'device-1'),
}))

const TOKEN = 'ExponentPushToken[abc]'
const BODY = { token: TOKEN, conversationId: 'conv-1' }

const SERVER_INFO = { version: '1', machineName: 'm', platform: 'darwin', activeSessions: 0 }

const pair = (push?: { preferences?: boolean; subscriptions?: boolean }) =>
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
  mockPut.mockResolvedValue(undefined)
  mockDelete.mockResolvedValue(undefined)
  pair({ preferences: true, subscriptions: true })
})

describe('serverSupportsPushSubscriptions', () => {
  it('reads support from push.subscriptions only', () => {
    expect(serverSupportsPushSubscriptions('srv')).toBe(true)
    pair({ preferences: true })
    expect(serverSupportsPushSubscriptions('srv')).toBe(false)
    pair({ preferences: true, subscriptions: false })
    expect(serverSupportsPushSubscriptions('srv')).toBe(false)
    pair(undefined)
    expect(serverSupportsPushSubscriptions('srv')).toBe(false)
    expect(serverSupportsPushSubscriptions('unknown')).toBe(false)
  })
})

describe('subscribeExternalSession', () => {
  it('puts the token and conversation id', async () => {
    await expect(subscribeExternalSession('srv', 'conv-1')).resolves.toBe(true)
    expect(mockPut).toHaveBeenCalledTimes(1)
    expect(mockPut).toHaveBeenCalledWith('/api/push/subscriptions', BODY)
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('returns false and sends nothing without a push token', async () => {
    ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false })
    await expect(subscribeExternalSession('srv', 'conv-1')).resolves.toBe(false)
    expect(mockPut).not.toHaveBeenCalled()
  })

  it('registers the token and retries once when the server does not know it', async () => {
    mockPut.mockRejectedValueOnce(new NotFoundError('/api/push/subscriptions'))
    await expect(subscribeExternalSession('srv', 'conv-1')).resolves.toBe(true)

    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost.mock.calls[0][0]).toBe('/api/push/register')
    expect(mockPut).toHaveBeenCalledTimes(2)
    expect(mockPut.mock.calls[1]).toEqual(['/api/push/subscriptions', BODY])
  })

  it('retries only once: a second 404 is thrown', async () => {
    mockPut
      .mockRejectedValueOnce(new NotFoundError('/api/push/subscriptions'))
      .mockRejectedValueOnce(new NotFoundError('/api/push/subscriptions'))
    await expect(subscribeExternalSession('srv', 'conv-1')).rejects.toBeInstanceOf(NotFoundError)
    expect(mockPut).toHaveBeenCalledTimes(2)
  })

  it('does not re-register for any other failure', async () => {
    mockPut.mockRejectedValueOnce(new Error('network down'))
    await expect(subscribeExternalSession('srv', 'conv-1')).rejects.toThrow('network down')
    expect(mockPost).not.toHaveBeenCalled()
    expect(mockPut).toHaveBeenCalledTimes(1)
  })
})

describe('unsubscribeExternalSession', () => {
  it('deletes the token and conversation id', async () => {
    await expect(unsubscribeExternalSession('srv', 'conv-1')).resolves.toBe(true)
    expect(mockDelete).toHaveBeenCalledWith('/api/push/subscriptions', BODY)
  })

  it('returns false and sends nothing without a push token', async () => {
    ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false })
    await expect(unsubscribeExternalSession('srv', 'conv-1')).resolves.toBe(false)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('treats an unknown token as already unsubscribed', async () => {
    mockDelete.mockRejectedValueOnce(new NotFoundError('/api/push/subscriptions'))
    await expect(unsubscribeExternalSession('srv', 'conv-1')).resolves.toBe(true)
  })

  it('throws any other failure', async () => {
    mockDelete.mockRejectedValueOnce(new Error('network down'))
    await expect(unsubscribeExternalSession('srv', 'conv-1')).rejects.toThrow('network down')
  })
})
