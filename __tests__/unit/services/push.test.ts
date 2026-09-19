import { requestPermissions } from '@/services/push'
import * as Notifications from 'expo-notifications'

beforeEach(() => {
  jest.clearAllMocks()
})

// ── requestPermissions ────────────────────────────────────────────────────────

describe('requestPermissions', () => {
  it('returns true when permissions already granted', async () => {
    ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted', granted: true })
    const result = await requestPermissions()
    expect(result).toBe(true)
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled()
  })

  it('requests permissions when not granted and returns true on grant', async () => {
    ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'undetermined', granted: false })
    ;(Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted', granted: true })
    const result = await requestPermissions()
    expect(result).toBe(true)
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled()
  })

  it('returns false when permissions denied', async () => {
    ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied', granted: false })
    ;(Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied', granted: false })
    const result = await requestPermissions()
    expect(result).toBe(false)
  })
})
