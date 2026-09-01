import AsyncStorage from '@react-native-async-storage/async-storage'
import { persistSettingsNow, useSettingsStore } from '@/stores/settings'

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'he' }]),
}))

const MODULE_DEFAULT_LOCALE = useSettingsStore.getState().locale

const DEFAULT_NOTIFICATIONS = {
  waitingInput: true,
  sessionComplete: true,
  sessionFailed: true,
  diffReady: false,
  quietHoursEnabled: false,
  quietHoursFrom: '22:00',
  quietHoursTo: '08:00',
  showBadge: true,
}

beforeEach(() => {
  ;(AsyncStorage.setItem as jest.Mock).mockClear()
  ;(AsyncStorage.getItem as jest.Mock).mockClear()
  useSettingsStore.setState({
    colorScheme: 'dark',
    completedSessionFadeMs: 60000,
    terminalMaxLines: 5000,
    notifications: { ...DEFAULT_NOTIFICATIONS },
    crashReportingEnabled: false,
    crashReportingNoticeDismissed: false,
    sessionLeaveAction: 'ask',
    locale: 'he',
  })
})

describe('SettingsStore – locale', () => {
  it('defaults to the resolved device locale', () => {
    expect(MODULE_DEFAULT_LOCALE).toBe('he')
  })

  it('persists a supported locale', async () => {
    useSettingsStore.getState().setLocale('ar')
    await persistSettingsNow()

    const raw = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)
    expect(JSON.parse(raw[1]).locale).toBe('ar')
  })

  it('coerces an invalid persisted locale to the resolved device locale', async () => {
    useSettingsStore.setState({ locale: 'ar' })
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify({ locale: 'ja' }))

    await useSettingsStore.getState().hydrate()

    expect(useSettingsStore.getState().locale).toBe('he')
  })

  it('awaits the AsyncStorage write in persistSettingsNow', async () => {
    let complete = false
    ;(AsyncStorage.setItem as jest.Mock).mockImplementationOnce(
      () => new Promise<void>((resolve) => setTimeout(() => {
        complete = true
        resolve()
      }, 0)),
    )

    const persistence = persistSettingsNow()
    expect(complete).toBe(false)
    await persistence
    expect(complete).toBe(true)
  })
})

describe('SettingsStore – colorScheme', () => {
  it('defaults to dark', () => {
    expect(useSettingsStore.getState().colorScheme).toBe('dark')
  })

  it('updates colorScheme to light', () => {
    useSettingsStore.getState().setColorScheme('light')
    expect(useSettingsStore.getState().colorScheme).toBe('light')
  })

  it('accepts system as valid scheme', () => {
    useSettingsStore.getState().setColorScheme('system')
    expect(useSettingsStore.getState().colorScheme).toBe('system')
  })

  it('accepts catppuccin', () => {
    useSettingsStore.getState().setColorScheme('catppuccin')
    expect(useSettingsStore.getState().colorScheme).toBe('catppuccin')
  })

  it('accepts nord', () => {
    useSettingsStore.getState().setColorScheme('nord')
    expect(useSettingsStore.getState().colorScheme).toBe('nord')
  })

  it('persists colorScheme to AsyncStorage when changed', async () => {
    useSettingsStore.getState().setColorScheme('nord')
    // Allow the subscriber microtask to flush
    await Promise.resolve()
    const raw = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)
    expect(raw).toBeDefined()
    const payload = JSON.parse(raw[1])
    expect(payload.colorScheme).toBe('nord')
  })

  it('restores colorScheme from AsyncStorage on hydrate', async () => {
    const stored = JSON.stringify({ colorScheme: 'nord', notifications: DEFAULT_NOTIFICATIONS })
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(stored)
    await useSettingsStore.getState().hydrate()
    expect(useSettingsStore.getState().colorScheme).toBe('nord')
  })

  it('falls back to dark when hydrate finds no stored colorScheme', async () => {
    const stored = JSON.stringify({ notifications: DEFAULT_NOTIFICATIONS })
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(stored)
    await useSettingsStore.getState().hydrate()
    expect(useSettingsStore.getState().colorScheme).toBe('dark')
  })

  it('migrates a persisted Apple Glass selection to dark', async () => {
    const stored = JSON.stringify({
      colorScheme: 'appleGlass',
      glassThemeVariant: 'sunset',
      notifications: DEFAULT_NOTIFICATIONS,
    })
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(stored)
    await useSettingsStore.getState().hydrate()
    expect(useSettingsStore.getState().colorScheme).toBe('dark')
  })

  it('migrates a persisted Dracula selection to dark', async () => {
    const stored = JSON.stringify({
      colorScheme: 'dracula',
      notifications: DEFAULT_NOTIFICATIONS,
    })
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(stored)
    await useSettingsStore.getState().hydrate()
    expect(useSettingsStore.getState().colorScheme).toBe('dark')
  })
})

describe('SettingsStore – completedSessionFadeMs', () => {
  it('defaults to 60000', () => {
    expect(useSettingsStore.getState().completedSessionFadeMs).toBe(60000)
  })

  it('updates completedSessionFadeMs', () => {
    useSettingsStore.getState().setCompletedSessionFadeMs(30000)
    expect(useSettingsStore.getState().completedSessionFadeMs).toBe(30000)
  })
})

describe('SettingsStore – terminalMaxLines', () => {
  it('defaults to 5000', () => {
    expect(useSettingsStore.getState().terminalMaxLines).toBe(5000)
  })

  it('updates terminalMaxLines', () => {
    useSettingsStore.getState().setTerminalMaxLines(1000)
    expect(useSettingsStore.getState().terminalMaxLines).toBe(1000)
  })
})

describe('SettingsStore – notifications', () => {
  it('has correct defaults', () => {
    expect(useSettingsStore.getState().notifications).toEqual(DEFAULT_NOTIFICATIONS)
  })

  it('merges partial update', () => {
    useSettingsStore.getState().setNotifications({ diffReady: true })
    const n = useSettingsStore.getState().notifications
    expect(n.diffReady).toBe(true)
    expect(n.waitingInput).toBe(true) // unchanged
  })

  it('can disable an enabled notification', () => {
    useSettingsStore.getState().setNotifications({ waitingInput: false })
    expect(useSettingsStore.getState().notifications.waitingInput).toBe(false)
  })

  it('can enable quiet hours', () => {
    useSettingsStore.getState().setNotifications({ quietHoursEnabled: true, quietHoursFrom: '23:00', quietHoursTo: '07:00' })
    const n = useSettingsStore.getState().notifications
    expect(n.quietHoursEnabled).toBe(true)
    expect(n.quietHoursFrom).toBe('23:00')
    expect(n.quietHoursTo).toBe('07:00')
  })

  it('does not wipe unrelated fields on partial update', () => {
    useSettingsStore.getState().setNotifications({ showBadge: false })
    const n = useSettingsStore.getState().notifications
    expect(n.sessionComplete).toBe(true)
    expect(n.sessionFailed).toBe(true)
    expect(n.showBadge).toBe(false)
  })
})

describe('SettingsStore – crashReportingEnabled (opt-in consent)', () => {
  it('defaults to OFF for new installations', () => {
    expect(useSettingsStore.getState().crashReportingEnabled).toBe(false)
    expect(useSettingsStore.getState().crashReportingNoticeDismissed).toBe(false)
  })

  it('can be enabled and disabled', () => {
    useSettingsStore.getState().setCrashReportingEnabled(true)
    expect(useSettingsStore.getState().crashReportingEnabled).toBe(true)
    useSettingsStore.getState().setCrashReportingEnabled(false)
    expect(useSettingsStore.getState().crashReportingEnabled).toBe(false)
  })

  it('persists the consent preference to AsyncStorage', async () => {
    useSettingsStore.getState().setCrashReportingEnabled(true)
    await Promise.resolve()
    const raw = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)
    const payload = JSON.parse(raw[1])
    expect(payload.crashReportingEnabled).toBe(true)
  })

  it('restores the consent preference on hydrate', async () => {
    const stored = JSON.stringify({
      crashReportingEnabled: true,
      crashReportingNoticeDismissed: true,
      notifications: DEFAULT_NOTIFICATIONS,
    })
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(stored)
    await useSettingsStore.getState().hydrate()
    expect(useSettingsStore.getState().crashReportingEnabled).toBe(true)
    expect(useSettingsStore.getState().crashReportingNoticeDismissed).toBe(true)
  })

  it('stays OFF when hydrate finds no stored value', async () => {
    const stored = JSON.stringify({ notifications: DEFAULT_NOTIFICATIONS })
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(stored)
    await useSettingsStore.getState().hydrate()
    expect(useSettingsStore.getState().crashReportingEnabled).toBe(false)
  })
})

describe('SettingsStore – sessionLeaveAction', () => {
  it('defaults to always ask', () => {
    expect(useSettingsStore.getState().sessionLeaveAction).toBe('ask')
  })

  it('persists and can restore Always ask', async () => {
    useSettingsStore.getState().setSessionLeaveAction('kill')
    await Promise.resolve()
    const raw = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)
    expect(JSON.parse(raw[1]).sessionLeaveAction).toBe('kill')

    useSettingsStore.getState().setSessionLeaveAction('ask')
    expect(useSettingsStore.getState().sessionLeaveAction).toBe('ask')
  })

  it('hydrates a stored action and rejects unknown values', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({ sessionLeaveAction: 'kill_on_idle', notifications: DEFAULT_NOTIFICATIONS }),
    )
    await useSettingsStore.getState().hydrate()
    expect(useSettingsStore.getState().sessionLeaveAction).toBe('kill_on_idle')

    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({ sessionLeaveAction: 'explode', notifications: DEFAULT_NOTIFICATIONS }),
    )
    await useSettingsStore.getState().hydrate()
    expect(useSettingsStore.getState().sessionLeaveAction).toBe('ask')
  })
})
