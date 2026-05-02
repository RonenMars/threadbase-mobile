import AsyncStorage from '@react-native-async-storage/async-storage'
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
  ;(AsyncStorage.setItem as jest.Mock).mockClear()
  ;(AsyncStorage.getItem as jest.Mock).mockClear()
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

  it('updates colorScheme to light', () => {
    useSettingsStore.getState().setColorScheme('light')
    expect(useSettingsStore.getState().colorScheme).toBe('light')
  })

  it('accepts system as valid scheme', () => {
    useSettingsStore.getState().setColorScheme('system')
    expect(useSettingsStore.getState().colorScheme).toBe('system')
  })

  it('accepts dracula', () => {
    useSettingsStore.getState().setColorScheme('dracula')
    expect(useSettingsStore.getState().colorScheme).toBe('dracula')
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
    useSettingsStore.getState().setColorScheme('dracula')
    // Allow the subscriber microtask to flush
    await Promise.resolve()
    const raw = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)
    expect(raw).toBeDefined()
    const payload = JSON.parse(raw[1])
    expect(payload.colorScheme).toBe('dracula')
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
