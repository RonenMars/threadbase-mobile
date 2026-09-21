import { act, renderHook } from '@testing-library/react-native'
import { AppState } from 'react-native'
import type { AppStateStatus } from 'react-native'
import { useNotificationPrefsSync } from '@/hooks/useNotificationPrefsSync'
import { deviceTimeZone } from '@/lib/notification-prefs'
import { syncNotificationPrefsForAll } from '@/services/push'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'

/**
 * Registration already carries the preferences, so the hook only owns what
 * changes afterwards. The failure worth locking down is the quiet one: an edit
 * that stays on the phone, or a change of time zone the server never hears
 * about, so quiet hours keep running on the old clock.
 */

jest.mock('@/services/push', () => ({
  syncNotificationPrefsForAll: jest.fn(async () => {}),
}))

jest.mock('@/lib/notification-prefs', () => ({
  ...jest.requireActual('@/lib/notification-prefs'),
  deviceTimeZone: jest.fn(),
}))

const mockSync = syncNotificationPrefsForAll as jest.MockedFunction<typeof syncNotificationPrefsForAll>
const mockZone = deviceTimeZone as jest.MockedFunction<typeof deviceTimeZone>

let onAppState: (state: AppStateStatus) => void
const removeListener = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  mockZone.mockReturnValue('Asia/Jerusalem')
  useServersStore.setState({ activeServerIds: ['srv-a', 'srv-b'] })
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    onAppState = handler
    return { remove: removeListener } as unknown as ReturnType<typeof AppState.addEventListener>
  })
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('useNotificationPrefsSync', () => {
  it('does nothing on mount, since registration already sent the preferences', async () => {
    await renderHook(() => useNotificationPrefsSync())
    expect(mockSync).not.toHaveBeenCalled()
  })

  it('syncs every active server when a preference changes', async () => {
    await renderHook(() => useNotificationPrefsSync())

    await act(async () => {
      useSettingsStore.getState().setNotifications({ waitingInput: false })
    })

    expect(mockSync).toHaveBeenCalledTimes(1)
    expect(mockSync).toHaveBeenCalledWith(['srv-a', 'srv-b'])
  })

  it('does not sync again just because the server list changed', async () => {
    await renderHook(() => useNotificationPrefsSync())

    await act(async () => {
      useServersStore.setState({ activeServerIds: ['srv-a'] })
    })

    expect(mockSync).not.toHaveBeenCalled()
  })

  it('syncs when the app returns to the foreground in a different time zone', async () => {
    await renderHook(() => useNotificationPrefsSync())

    mockZone.mockReturnValue('America/New_York')
    await act(async () => {
      onAppState('active')
    })

    expect(mockSync).toHaveBeenCalledWith(['srv-a', 'srv-b'])
  })

  it('stays quiet when the foreground return finds the same zone, or the app is going away', async () => {
    await renderHook(() => useNotificationPrefsSync())

    await act(async () => {
      onAppState('active')
    })
    mockZone.mockReturnValue('America/New_York')
    await act(async () => {
      onAppState('background')
    })

    expect(mockSync).not.toHaveBeenCalled()
  })

  it('reports a zone change once, not on every later foreground', async () => {
    await renderHook(() => useNotificationPrefsSync())
    mockZone.mockReturnValue('America/New_York')

    await act(async () => {
      onAppState('active')
      onAppState('active')
    })

    expect(mockSync).toHaveBeenCalledTimes(1)
  })

  it('removes its AppState listener on unmount', async () => {
    const { unmount } = await renderHook(() => useNotificationPrefsSync())
    await unmount()
    expect(removeListener).toHaveBeenCalledTimes(1)
  })
})
