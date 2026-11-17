import { requestPermissions, setViewedSession } from '@/services/push'
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

// ── foreground handler ────────────────────────────────────────────────────────

describe('foreground notification handler', () => {
  // The handler is registered when services/push loads, before beforeEach clears the mock.
  const handler = (Notifications.setNotificationHandler as jest.Mock).mock.calls[0][0].handleNotification as (
    n: unknown,
  ) => Promise<{ shouldShowBanner: boolean; shouldShowList: boolean; shouldPlaySound: boolean; shouldSetBadge: boolean }>
  const pushFor = (serverId: string, sessionId: string) => ({ request: { content: { data: { serverId, sessionId } } } })

  afterEach(() => setViewedSession(null))

  it('shows everything when no session is open', async () => {
    expect(await handler(pushFor('srv_a', 's1'))).toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    })
  })

  it('shows nothing for the session being viewed', async () => {
    setViewedSession({ serverId: 'srv_a', sessionId: 's1' })
    expect(await handler(pushFor('srv_a', 's1'))).toEqual({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    })
  })

  it('still shows a different session, or the same id on another server', async () => {
    setViewedSession({ serverId: 'srv_a', sessionId: 's1' })
    expect((await handler(pushFor('srv_a', 's2'))).shouldShowBanner).toBe(true)
    expect((await handler(pushFor('srv_b', 's1'))).shouldShowBanner).toBe(true)
  })
})
