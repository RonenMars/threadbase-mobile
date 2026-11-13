import { Platform } from 'react-native'

/**
 * Android 13+ shows the POST_NOTIFICATIONS prompt only once the app owns a
 * channel; asked earlier, `requestPermissionsAsync` can resolve denied without
 * showing anything. Channels must therefore exist before the prompt.
 */
const mockSetChannel = jest.fn(async () => null)
const mockRequest = jest.fn(async () => ({ status: 'granted', granted: true, canAskAgain: true }))

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'undetermined', granted: false })),
  requestPermissionsAsync: (...args: unknown[]) => mockRequest(...(args as [])),
  setNotificationChannelAsync: (...args: unknown[]) => mockSetChannel(...(args as [])),
  setNotificationCategoryAsync: jest.fn(async () => ({})),
  AndroidImportance: { HIGH: 5, DEFAULT: 3 },
}))

function load() {
  let mod!: typeof import('@/services/push')
  jest.isolateModules(() => {
    mod = require('@/services/push')
  })
  return mod
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.replaceProperty(Platform, 'OS', 'android')
})

describe('requestNotificationPermission', () => {
  it('creates the channels before it shows the prompt', async () => {
    const { requestNotificationPermission } = load()

    await requestNotificationPermission()

    expect(mockSetChannel).toHaveBeenCalledTimes(2)
    expect(mockRequest).toHaveBeenCalledTimes(1)
    const lastChannel = Math.max(...mockSetChannel.mock.invocationCallOrder)
    expect(lastChannel).toBeLessThan(mockRequest.mock.invocationCallOrder[0])
  })

  it('still prompts when channel setup fails', async () => {
    mockSetChannel.mockRejectedValueOnce(new Error('native module unavailable'))
    const { requestNotificationPermission } = load()

    await expect(requestNotificationPermission()).resolves.toMatchObject({ granted: true })
  })

  it('is the path requestPermissions takes, so the legacy helper cannot skip the channels', async () => {
    const { requestPermissions } = load()

    await requestPermissions()

    expect(mockSetChannel).toHaveBeenCalled()
    expect(Math.max(...mockSetChannel.mock.invocationCallOrder)).toBeLessThan(
      mockRequest.mock.invocationCallOrder[0],
    )
  })
})
