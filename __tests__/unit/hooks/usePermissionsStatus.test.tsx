import { act, renderHook, waitFor } from '@testing-library/react-native'
import * as Notifications from 'expo-notifications'
import { usePermissionsStatus } from '@/hooks/usePermissionsStatus'
import { requestNotificationPermission } from '@/services/push'

// Stable identity: the hook syncs camera status in an effect keyed on this object.
const mockCamera = [{ status: 'granted' }, jest.fn()]
jest.mock('@/hooks/useLiveCameraPermissions', () => ({
  useLiveCameraPermissions: () => mockCamera,
}))
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: { getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })) },
}))
jest.mock('@/services/push', () => ({ requestNotificationPermission: jest.fn() }))

const getPermissions = Notifications.getPermissionsAsync as jest.Mock
const request = requestNotificationPermission as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe('usePermissionsStatus – notifications canAskAgain', () => {
  it('reports that a prompt is still possible after one denial', async () => {
    getPermissions.mockResolvedValue({ status: 'denied', canAskAgain: true })
    const { result } = await renderHook(() => usePermissionsStatus())

    await waitFor(() => expect(result.current.statuses.notifications).toBe('denied'))
    expect(result.current.notificationsCanAskAgain).toBe(true)
  })

  it('reports denied-forever so the row opens system settings', async () => {
    getPermissions.mockResolvedValue({ status: 'denied', canAskAgain: false })
    const { result } = await renderHook(() => usePermissionsStatus())

    await waitFor(() => expect(result.current.notificationsCanAskAgain).toBe(false))
  })

  it('learns a second denial was final from the prompt result', async () => {
    getPermissions.mockResolvedValue({ status: 'denied', canAskAgain: true })
    request.mockResolvedValue({ status: 'denied', canAskAgain: false })
    const { result } = await renderHook(() => usePermissionsStatus())
    await waitFor(() => expect(result.current.statuses.notifications).toBe('denied'))

    await act(async () => {
      await result.current.request('notifications')
    })

    expect(request).toHaveBeenCalledTimes(1)
    expect(result.current.notificationsCanAskAgain).toBe(false)
  })
})
