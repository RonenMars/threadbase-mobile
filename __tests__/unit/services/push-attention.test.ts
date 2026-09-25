import type * as Notifications from 'expo-notifications'

/**
 * attention-v1: the channels and permission buttons the streamer's pushes name,
 * and the answer an Allow / Deny tap sends.
 *
 * The costly failures are silent ones: advertising the feature without having
 * created the channels (Android then shows nothing at all), and a button that
 * answers something the user did not choose.
 */

const mockPost = jest.fn(async () => ({ ok: true }))
const mockSetChannel = jest.fn(async () => null)
const mockSetCategory = jest.fn(async () => ({}))

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[abc]' })),
  setNotificationChannelAsync: (...args: unknown[]) => mockSetChannel(...(args as [])),
  setNotificationCategoryAsync: (...args: unknown[]) => mockSetCategory(...(args as [])),
  AndroidImportance: { HIGH: 5, DEFAULT: 3 },
}))

jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({ post: mockPost }),
  NotFoundError: class NotFoundError extends Error {},
}))

jest.mock('@/services/device-id', () => ({
  getDeviceClientId: jest.fn(async () => 'device-1'),
}))

/** A fresh module per test: the setup is memoized per language. */
function load() {
  let mod!: typeof import('@/services/push')
  let settings!: typeof import('@/stores/settings')
  jest.isolateModules(() => {
    mod = require('@/services/push')
    settings = require('@/stores/settings')
  })
  return { ...mod, settings }
}

beforeEach(() => {
  jest.clearAllMocks()
})

function registeredBody(): Record<string, unknown> {
  const call = mockPost.mock.calls.find((c) => (c as unknown[])[0] === '/api/push/register')
  return (call as unknown as [string, Record<string, unknown>])[1]
}

describe('registration advertises attention-v1 only once it is set up', () => {
  it('creates both channels and the permission buttons, then lists the feature', async () => {
    const { registerPushToken } = load()

    await registerPushToken('srv_aaa')

    expect(mockSetChannel).toHaveBeenCalledWith(
      'needs-you',
      expect.objectContaining({ importance: 5, vibrationPattern: expect.any(Array) }),
    )
    expect(mockSetChannel).toHaveBeenCalledWith('updates', expect.objectContaining({ importance: 3 }))
    const [id, actions] = mockSetCategory.mock.calls[0] as unknown as [
      string,
      Notifications.NotificationAction[],
    ]
    expect(id).toBe('permission')
    expect(actions.map((a) => [a.identifier, a.options?.opensAppToForeground])).toEqual([
      ['allow', true],
      ['deny', true],
    ])
    expect(registeredBody().notificationFeatures).toEqual(['attention-v1'])
  })

  it('leaves the feature out when setup fails, so no push names a missing channel', async () => {
    mockSetCategory.mockRejectedValueOnce(new Error('unsupported'))
    const { registerPushToken } = load()

    await registerPushToken('srv_aaa')

    expect(registeredBody()).not.toHaveProperty('notificationFeatures')
  })
})

function response(
  actionIdentifier: string,
  data: Record<string, unknown>,
  identifier = 'n-1',
): Notifications.NotificationResponse {
  return {
    actionIdentifier,
    notification: { request: { identifier, content: { data } } },
  } as unknown as Notifications.NotificationResponse
}

const DATA = {
  sessionId: 'sess-1',
  serverId: 'srv_aaa',
  kind: 'permission',
  gateId: 'gate-1',
  allowOption: '0',
  denyOption: '2',
}
const known = () => true

describe('answerFromNotification', () => {
  it('answers Allow with the gate id and the allow position', async () => {
    const { answerFromNotification } = load()

    await expect(answerFromNotification(response('allow', DATA), known)).resolves.toBe(true)

    expect(mockPost).toHaveBeenCalledWith('/api/sessions/sess-1/permission/answer', {
      gateId: 'gate-1',
      optionIndex: 0,
    })
  })

  it('answers Deny with the deny position', async () => {
    const { answerFromNotification } = load()

    await answerFromNotification(response('deny', DATA), known)

    expect(mockPost).toHaveBeenCalledWith('/api/sessions/sess-1/permission/answer', {
      gateId: 'gate-1',
      optionIndex: 2,
    })
  })

  it('answers one tap once, though launch read-back and the listener both see it', async () => {
    const { answerFromNotification } = load()

    await answerFromNotification(response('allow', DATA), known)
    await answerFromNotification(response('allow', DATA), known)

    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['a plain tap', response('expo.modules.notifications.actions.DEFAULT', DATA)],
    ['a push with no gate id', response('allow', { ...DATA, gateId: undefined })],
    ['a push with no position', response('allow', { ...DATA, allowOption: undefined })],
  ])('sends nothing for %s', async (_, r) => {
    const { answerFromNotification } = load()

    await expect(answerFromNotification(r, known)).resolves.toBe(false)
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('sends nothing for a server this app does not know', async () => {
    const { answerFromNotification } = load()

    await answerFromNotification(response('allow', DATA), () => false)

    expect(mockPost).not.toHaveBeenCalled()
  })

  it("leaves the gate to the app when the app's own biometric lock is on", async () => {
    const { answerFromNotification, settings } = load()
    settings.useSettingsStore.setState({ biometricLock: true })

    await answerFromNotification(response('allow', DATA), known)

    expect(mockPost).not.toHaveBeenCalled()
  })

  it('resolves false when the server refuses a gate that moved on', async () => {
    mockPost.mockRejectedValueOnce(new Error('409 gate_mismatch'))
    const { answerFromNotification } = load()

    await expect(answerFromNotification(response('allow', DATA), known)).resolves.toBe(false)
  })
})
