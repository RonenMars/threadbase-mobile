import AsyncStorage from '@react-native-async-storage/async-storage'
import { persistSettingsNow, useSettingsStore } from '@/stores/settings'

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'he' }]),
}))

const MODULE_DEFAULT_LOCALE = useSettingsStore.getState().locale

const DEFAULT_NOTIFICATIONS = {
  waitingInput: true,
  sessionFailed: true,
  quietHoursEnabled: false,
  quietHoursFrom: '22:00',
  quietHoursTo: '08:00',
  quietHoursDays: {},
}

beforeEach(() => {
  ;(AsyncStorage.setItem as jest.Mock).mockClear()
  ;(AsyncStorage.getItem as jest.Mock).mockClear()
  useSettingsStore.setState({
    colorScheme: 'dark',
    completedSessionFadeMs: 60000,
    terminalMaxLines: 5000,
    notifications: { ...DEFAULT_NOTIFICATIONS },
    anonymousDiagnosticsEnabled: false,
    crashReportingNoticeDismissed: false,
    sessionLeaveAction: 'leave',
    skipLeaveNotice: false,
    showProviderVersionWarning: false,
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

  it.each([
    ['githubDark', 'dark'],
    ['githubLight', 'light'],
    ['oneLight', 'light'],
    ['solarizedDark', 'dark'],
    ['solarizedLight', 'light'],
    ['rosePine', 'catppuccin'],
    ['tokyoNight', 'catppuccin'],
  ])('migrates a persisted %s selection to %s', async (retired, kept) => {
    const stored = JSON.stringify({ colorScheme: retired, notifications: DEFAULT_NOTIFICATIONS })
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(stored)
    useSettingsStore.setState({ colorScheme: 'nord' })
    await useSettingsStore.getState().hydrate()
    expect(useSettingsStore.getState().colorScheme).toBe(kept)
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

  it.each([
    ['tree', 'projects'],
    ['hub', 'projects'],
    ['classic', 'now'],
    ['projects', 'projects'],
    ['now', 'now'],
    [undefined, 'now'],
  ])('migrates a persisted sessionsLayout of %s to %s', async (stored, expected) => {
    const raw = JSON.stringify({ sessionsLayout: stored, notifications: DEFAULT_NOTIFICATIONS })
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(raw)
    await useSettingsStore.getState().hydrate()
    expect(useSettingsStore.getState().sessionsLayout).toBe(expected)
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
    useSettingsStore.getState().setNotifications({ sessionFailed: false })
    const n = useSettingsStore.getState().notifications
    expect(n.sessionFailed).toBe(false)
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
    useSettingsStore.getState().setNotifications({ quietHoursEnabled: true })
    const n = useSettingsStore.getState().notifications
    expect(n.waitingInput).toBe(true)
    expect(n.sessionFailed).toBe(true)
    expect(n.quietHoursFrom).toBe('22:00')
    expect(n.quietHoursEnabled).toBe(true)
  })

  it('stores per-weekday quiet hours, with null meaning no quiet hours that day', () => {
    useSettingsStore.getState().setNotifications({
      quietHoursDays: { fri: { from: '23:30', to: '10:00' }, sat: null },
    })
    expect(useSettingsStore.getState().notifications.quietHoursDays).toEqual({
      fri: { from: '23:30', to: '10:00' },
      sat: null,
    })
  })
})

describe('SettingsStore – notifications migration', () => {
  const hydrated = async (notifications: object) => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify({ notifications }))
    await useSettingsStore.getState().hydrate()
    return useSettingsStore.getState().notifications
  }

  it('keeps the settings that survive and drops the retired ones', async () => {
    const n = await hydrated({
      waitingInput: false,
      sessionComplete: true,
      sessionFailed: false,
      diffReady: true,
      showBadge: false,
      quietHoursEnabled: true,
      quietHoursFrom: '23:00',
      quietHoursTo: '07:00',
    })
    expect(n).toEqual({
      waitingInput: false,
      sessionFailed: false,
      quietHoursEnabled: true,
      quietHoursFrom: '23:00',
      quietHoursTo: '07:00',
      quietHoursDays: {},
    })
    expect(n).not.toHaveProperty('sessionComplete')
    expect(n).not.toHaveProperty('diffReady')
    expect(n).not.toHaveProperty('showBadge')
  })

  it('does not write the retired keys back to storage', async () => {
    await hydrated({ sessionComplete: true, diffReady: true, showBadge: true })
    await persistSettingsNow()
    const written = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)[1])
    expect(Object.keys(written.notifications).sort()).toEqual(Object.keys(DEFAULT_NOTIFICATIONS).sort())
  })

  it('falls back to the default for a malformed time rather than sending it to a server', async () => {
    const n = await hydrated({ quietHoursFrom: '25:99', quietHoursTo: 'late' })
    expect(n.quietHoursFrom).toBe('22:00')
    expect(n.quietHoursTo).toBe('08:00')
  })

  it('keeps valid per-day windows and drops invalid ones', async () => {
    const n = await hydrated({
      quietHoursDays: { mon: { from: '09:00', to: '17:00' }, tue: null, wed: { from: 'x', to: '17:00' } },
    })
    expect(n.quietHoursDays).toEqual({ mon: { from: '09:00', to: '17:00' }, tue: null })
  })
})

describe('SettingsStore – anonymousDiagnosticsEnabled (opt-in consent)', () => {
  it('defaults to OFF for new installations', () => {
    expect(useSettingsStore.getState().anonymousDiagnosticsEnabled).toBe(false)
    expect(useSettingsStore.getState().crashReportingNoticeDismissed).toBe(false)
  })

  it('can be enabled and disabled', () => {
    useSettingsStore.getState().setAnonymousDiagnosticsEnabled(true)
    expect(useSettingsStore.getState().anonymousDiagnosticsEnabled).toBe(true)
    useSettingsStore.getState().setAnonymousDiagnosticsEnabled(false)
    expect(useSettingsStore.getState().anonymousDiagnosticsEnabled).toBe(false)
  })

  it('persists the consent preference to AsyncStorage', async () => {
    useSettingsStore.getState().setAnonymousDiagnosticsEnabled(true)
    await Promise.resolve()
    const raw = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)
    const payload = JSON.parse(raw[1])
    expect(payload.anonymousDiagnosticsEnabled).toBe(true)
  })

  it('restores the consent preference on hydrate', async () => {
    const stored = JSON.stringify({
      anonymousDiagnosticsEnabled: true,
      crashReportingNoticeDismissed: true,
      notifications: DEFAULT_NOTIFICATIONS,
    })
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(stored)
    await useSettingsStore.getState().hydrate()
    expect(useSettingsStore.getState().anonymousDiagnosticsEnabled).toBe(true)
    expect(useSettingsStore.getState().crashReportingNoticeDismissed).toBe(true)
  })

  it('stays OFF when hydrate finds no stored value', async () => {
    const stored = JSON.stringify({ notifications: DEFAULT_NOTIFICATIONS })
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(stored)
    await useSettingsStore.getState().hydrate()
    expect(useSettingsStore.getState().anonymousDiagnosticsEnabled).toBe(false)
  })
})

describe('SettingsStore – onboardingDiagnosticsExperimentVariant (spec §7)', () => {
  let randomSpy: jest.SpyInstance

  beforeEach(() => {
    useSettingsStore.setState({ onboardingDiagnosticsExperimentVariant: null })
    randomSpy = jest.spyOn(Math, 'random')
  })
  afterEach(() => {
    randomSpy.mockRestore()
  })

  it('assigns treatment for the bottom 40% of the random range', async () => {
    randomSpy.mockReturnValue(0.39)
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null)
    await useSettingsStore.getState().hydrate()
    expect(useSettingsStore.getState().onboardingDiagnosticsExperimentVariant).toBe('treatment')
  })

  it('assigns control for the top 60% of the random range', async () => {
    randomSpy.mockReturnValue(0.4)
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null)
    await useSettingsStore.getState().hydrate()
    expect(useSettingsStore.getState().onboardingDiagnosticsExperimentVariant).toBe('control')
  })

  it('is assigned even on a fresh install with nothing persisted yet', async () => {
    randomSpy.mockReturnValue(0.1)
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null)
    await useSettingsStore.getState().hydrate()
    expect(useSettingsStore.getState().onboardingDiagnosticsExperimentVariant).toBe('treatment')
  })

  it('never reassigns once persisted, regardless of a later random draw', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({ onboardingDiagnosticsExperimentVariant: 'control' }),
    )
    randomSpy.mockReturnValue(0.01) // would be "treatment" if it were re-rolled
    await useSettingsStore.getState().hydrate()
    expect(useSettingsStore.getState().onboardingDiagnosticsExperimentVariant).toBe('control')
  })

  it('never reassigns across repeated hydrate() calls in the same session', async () => {
    randomSpy.mockReturnValueOnce(0.1).mockReturnValueOnce(0.9)
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
    await useSettingsStore.getState().hydrate()
    const first = useSettingsStore.getState().onboardingDiagnosticsExperimentVariant
    await useSettingsStore.getState().hydrate()
    expect(useSettingsStore.getState().onboardingDiagnosticsExperimentVariant).toBe(first)
  })
})

describe('SettingsStore – postFeedbackDiagnosticsSuggestionImpressions (spec §14)', () => {
  beforeEach(() => {
    useSettingsStore.setState({ postFeedbackDiagnosticsSuggestionImpressions: [] })
  })

  it('starts empty', () => {
    expect(useSettingsStore.getState().postFeedbackDiagnosticsSuggestionImpressions).toEqual([])
  })

  it('appends a timestamp per impression, never overwriting prior ones', () => {
    useSettingsStore.getState().recordPostFeedbackDiagnosticsSuggestionImpression()
    useSettingsStore.getState().recordPostFeedbackDiagnosticsSuggestionImpression()
    expect(useSettingsStore.getState().postFeedbackDiagnosticsSuggestionImpressions).toHaveLength(2)
  })

  it('restores the impression history on hydrate', async () => {
    const stored = JSON.stringify({ postFeedbackDiagnosticsSuggestionImpressions: [111, 222] })
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(stored)
    await useSettingsStore.getState().hydrate()
    expect(useSettingsStore.getState().postFeedbackDiagnosticsSuggestionImpressions).toEqual([111, 222])
  })
})

describe('SettingsStore – sessionLeaveAction', () => {
  it('defaults to keep running', () => {
    expect(useSettingsStore.getState().sessionLeaveAction).toBe('leave')
  })

  it('persists and can restore Always ask', async () => {
    useSettingsStore.getState().setSessionLeaveAction('kill')
    await Promise.resolve()
    const raw = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)
    expect(JSON.parse(raw[1]).leaveAction).toBe('kill')

    useSettingsStore.getState().setSessionLeaveAction('ask')
    expect(useSettingsStore.getState().sessionLeaveAction).toBe('ask')
  })

  it('hydrates a stored action and rejects unknown values', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({ leaveAction: 'kill_on_idle', notifications: DEFAULT_NOTIFICATIONS }),
    )
    await useSettingsStore.getState().hydrate()
    expect(useSettingsStore.getState().sessionLeaveAction).toBe('kill_on_idle')

    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({ leaveAction: 'explode', notifications: DEFAULT_NOTIFICATIONS }),
    )
    await useSettingsStore.getState().hydrate()
    expect(useSettingsStore.getState().sessionLeaveAction).toBe('leave')
  })

  it('persists and hydrates skipping the Keep running notice', async () => {
    expect(useSettingsStore.getState().skipLeaveNotice).toBe(false)
    useSettingsStore.getState().setSkipLeaveNotice(true)
    await Promise.resolve()
    const raw = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)
    expect(JSON.parse(raw[1]).skipLeaveNotice).toBe(true)

    useSettingsStore.setState({ skipLeaveNotice: false })
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({ skipLeaveNotice: true, notifications: DEFAULT_NOTIFICATIONS }),
    )
    await useSettingsStore.getState().hydrate()
    expect(useSettingsStore.getState().skipLeaveNotice).toBe(true)
  })

  it('drops a choice saved under the old key, so every install starts on keep running', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({ sessionLeaveAction: 'ask', notifications: DEFAULT_NOTIFICATIONS }),
    )
    await useSettingsStore.getState().hydrate()
    expect(useSettingsStore.getState().sessionLeaveAction).toBe('leave')
  })
})

describe('SettingsStore – showProviderVersionWarning', () => {
  it('defaults to off', () => {
    expect(useSettingsStore.getState().showProviderVersionWarning).toBe(false)
  })

  it('persists and hydrates the toggle', async () => {
    useSettingsStore.getState().setShowProviderVersionWarning(true)
    await persistSettingsNow()
    const raw = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)
    expect(JSON.parse(raw[1]).showProviderVersionWarning).toBe(true)

    useSettingsStore.setState({ showProviderVersionWarning: false })
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({ showProviderVersionWarning: true }),
    )
    await useSettingsStore.getState().hydrate()
    expect(useSettingsStore.getState().showProviderVersionWarning).toBe(true)
  })
})
