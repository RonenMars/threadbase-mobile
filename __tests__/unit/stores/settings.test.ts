import { useSettingsStore } from '@/stores/settings'

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
  useSettingsStore.setState({
    colorScheme: 'dark',
    completedSessionFadeMs: 60000,
    terminalMaxLines: 5000,
    notifications: { ...DEFAULT_NOTIFICATIONS },
  })
})

describe('SettingsStore – colorScheme', () => {
  it('defaults to dark', () => {
    expect(useSettingsStore.getState().colorScheme).toBe('dark')
  })

  it('updates colorScheme', () => {
    useSettingsStore.getState().setColorScheme('light')
    expect(useSettingsStore.getState().colorScheme).toBe('light')
  })

  it('accepts system as valid scheme', () => {
    useSettingsStore.getState().setColorScheme('system')
    expect(useSettingsStore.getState().colorScheme).toBe('system')
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
