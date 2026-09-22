/**
 * E2E: Settings flow
 *
 * Tests the settings screen interactions: displaying server info, toggling
 * notification preferences, and the remove server confirmation flow.
 */
import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import { Alert } from 'react-native'
import SettingsScreen from '@/app/settings'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import { ThemeProvider } from '@/contexts/ThemeContext'

async function renderWithTheme(ui: React.ReactElement) {
  return await render(<ThemeProvider>{ui}</ThemeProvider>)
}

const mockReplace = jest.fn()
const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

const SERVER_INFO = {
  version: '2.1.0',
  machineName: 'dev-mac',
  platform: 'darwin',
  activeSessions: 3,
}

beforeEach(() => {
  mockReplace.mockReset()
  mockPush.mockReset()
  jest.clearAllMocks()

  useServersStore.setState({
    servers: {
      srv_test: {
        id: 'srv_test',
        url: 'http://my-server.local:7070',
        apiKey: 'live-key',
        label: 'Dev Mac',
        isConnected: true,
        serverInfo: SERVER_INFO,
        connectionError: null,
      },
    },
    activeServerIds: ['srv_test'],
    isLoading: false,
  })

  useSettingsStore.setState({
    colorScheme: 'dark',
    completedSessionFadeMs: 60000,
    terminalMaxLines: 5000,
    notifications: {
      waitingInput: true,
      sessionFailed: true,
      quietHoursEnabled: false,
      quietHoursFrom: '22:00',
      quietHoursTo: '08:00',
      quietHoursDays: {},
    },
  })
})

// ── Server section ────────────────────────────────────────────────────────────

describe('Settings – server section', () => {
  it('displays the server URL', async () => {
    const { getAllByText } = await renderWithTheme(<SettingsScreen />)
    expect(getAllByText('http://my-server.local:7070').length).toBeGreaterThan(0)
  })

  it('displays server machine name', async () => {
    const { getByText } = await renderWithTheme(<SettingsScreen />)
    expect(getByText(/dev-mac/)).toBeTruthy()
  })

  it('displays server version', async () => {
    const { getByText } = await renderWithTheme(<SettingsScreen />)
    expect(getByText(/2\.1\.0/)).toBeTruthy()
  })

  it('shows Delete server button', async () => {
    const { getByLabelText } = await renderWithTheme(<SettingsScreen />)
    expect(getByLabelText('Delete server')).toBeTruthy()
  })

  it('shows Add Server button', async () => {
    const { getByTestId } = await renderWithTheme(<SettingsScreen />)
    expect(getByTestId('settings-add-server-btn')).toBeTruthy()
  })

  it('opens Server Status from the servers section', async () => {
    const { getByTestId, getAllByText } = await renderWithTheme(<SettingsScreen />)
    expect(getByTestId('settings-server-status-row')).toBeTruthy()
    await fireEvent.press(getByTestId('settings-server-status-row'))
    expect(getAllByText('Server Status').length).toBeGreaterThan(0)
  })

  it('opens add server modal from settings', async () => {
    const { getByTestId } = await renderWithTheme(<SettingsScreen />)
    // Pressing "+ Add Server" opens the native form instead of navigating away.
    await fireEvent.press(getByTestId('settings-add-server-btn'))
    expect(mockPush).not.toHaveBeenCalled()
    expect(getByTestId('server-edit-url-input')).toBeTruthy()
  })

  it('exposes a stable selector for the Nord palette', async () => {
    const { getByTestId } = await renderWithTheme(<SettingsScreen />)
    expect(getByTestId('settings-theme-nord')).toBeTruthy()
  })

  it('exposes stable selectors for the palette tabs', async () => {
    const { getByTestId } = await renderWithTheme(<SettingsScreen />)
    expect(getByTestId('settings-theme-tab-dark')).toBeTruthy()
    expect(getByTestId('settings-theme-tab-light')).toBeTruthy()
  })
})

// ── Notifications section ────────────────────────────────────────���────────────

describe('Settings – notifications section', () => {
  it('shows the notification toggles the server can act on', async () => {
    const { getByText } = await renderWithTheme(<SettingsScreen />)
    expect(getByText('Waiting for Input')).toBeTruthy()
    expect(getByText('Session Failed')).toBeTruthy()
    expect(getByText('Quiet Hours')).toBeTruthy()
  })

  it('no longer offers the toggles that have no server event behind them', async () => {
    const { queryByText, getByText } = await renderWithTheme(<SettingsScreen />)
    expect(getByText('Session Failed')).toBeTruthy()
    expect(queryByText('Session Completed')).toBeNull()
    expect(queryByText('Diff Ready')).toBeNull()
    expect(queryByText('Show Badge Count')).toBeNull()
  })

  it('shows Send Test Notification button', async () => {
    const { getByText } = await renderWithTheme(<SettingsScreen />)
    expect(getByText('Send Test Notification')).toBeTruthy()
  })

  it('calls scheduleNotificationAsync when test notification is pressed', async () => {
    const Notifications = require('expo-notifications')
    const { getByText } = await renderWithTheme(<SettingsScreen />)

    await act(async () => {
      await fireEvent.press(getByText('Send Test Notification'))
    })

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled()
  })
})

// ── Server-enforced notification preferences ──────────────────────────────────

describe('Settings – notification preferences on a server that enforces them', () => {
  const QUIET_ON = {
    waitingInput: true,
    sessionFailed: true,
    quietHoursEnabled: true,
    quietHoursFrom: '22:00',
    quietHoursTo: '08:00',
    quietHoursDays: {},
  }

  const pairServer = (push: { preferences?: boolean } | undefined) => {
    useServersStore.setState({
      servers: {
        srv_test: {
          id: 'srv_test',
          url: 'http://my-server.local:7070',
          apiKey: 'live-key',
          label: 'Dev Mac',
          isConnected: true,
          serverInfo: push ? { ...SERVER_INFO, push } : SERVER_INFO,
          connectionError: null,
        },
      },
      activeServerIds: ['srv_test'],
      isLoading: false,
    })
  }

  const edit = async (input: Parameters<typeof fireEvent.changeText>[0], text: string) => {
    await fireEvent(input, 'focus')
    await fireEvent.changeText(input, text)
    await fireEvent(input, 'blur')
  }

  it('hides the schedule editor on a server that does not enforce preferences', async () => {
    pairServer(undefined)
    useSettingsStore.setState({ notifications: QUIET_ON })
    const { queryByTestId } = await renderWithTheme(<SettingsScreen />)
    expect(queryByTestId('quiet-hours-editor')).toBeNull()
  })

  it('shows the schedule editor once quiet hours is on and a server enforces them', async () => {
    pairServer({ preferences: true })
    useSettingsStore.setState({ notifications: QUIET_ON })
    const { queryByTestId } = await renderWithTheme(<SettingsScreen />)
    expect(queryByTestId('quiet-hours-editor')).toBeTruthy()
  })

  it('keeps the schedule editor away while quiet hours is off', async () => {
    pairServer({ preferences: true })
    const { queryByTestId } = await renderWithTheme(<SettingsScreen />)
    expect(queryByTestId('quiet-hours-editor')).toBeNull()
  })

  it('stores an edited window and rejects a malformed one', async () => {
    pairServer({ preferences: true })
    useSettingsStore.setState({ notifications: QUIET_ON })
    const { getByTestId } = await renderWithTheme(<SettingsScreen />)

    await edit(getByTestId('quiet-hours-global-from'), '23:15')
    expect(useSettingsStore.getState().notifications.quietHoursFrom).toBe('23:15')

    await edit(getByTestId('quiet-hours-global-to'), '99:99')
    expect(useSettingsStore.getState().notifications.quietHoursTo).toBe('08:00')
  })

  it('switches a weekday off as null and back on by dropping the override', async () => {
    pairServer({ preferences: true })
    useSettingsStore.setState({ notifications: QUIET_ON })
    const { getByTestId } = await renderWithTheme(<SettingsScreen />)

    await fireEvent.press(getByTestId('quiet-hours-by-day-toggle'))
    await fireEvent(getByTestId('quiet-hours-day-tue-switch'), 'valueChange', false)
    expect(useSettingsStore.getState().notifications.quietHoursDays).toEqual({ tue: null })

    await fireEvent(getByTestId('quiet-hours-day-tue-switch'), 'valueChange', true)
    expect(useSettingsStore.getState().notifications.quietHoursDays).toEqual({})
  })

  it('sends a real test push instead of a local notification', async () => {
    const push = require('@/services/push')
    const Notifications = require('expo-notifications')
    const sendTestPush = jest
      .spyOn(push, 'sendTestPush')
      .mockResolvedValue({ ok: true, attempted: 1, succeeded: 1, state: 'healthy' })
    pairServer({ preferences: true })
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const { getByText } = await renderWithTheme(<SettingsScreen />)

    await act(async () => {
      await fireEvent.press(getByText('Send Test Notification'))
    })

    expect(sendTestPush).toHaveBeenCalledWith('srv_test')
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled()
    expect(alert).not.toHaveBeenCalled()
  })

  it('says so when the server could not deliver the test push', async () => {
    const push = require('@/services/push')
    jest
      .spyOn(push, 'sendTestPush')
      .mockResolvedValue({ ok: false, attempted: 1, succeeded: 0, state: 'failing' })
    pairServer({ preferences: true })
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const { getByText } = await renderWithTheme(<SettingsScreen />)

    await act(async () => {
      await fireEvent.press(getByText('Send Test Notification'))
    })

    expect(alert).toHaveBeenCalledWith(
      'Test notification not delivered',
      expect.stringContaining('Delivery health'),
    )
  })
})

// ── About section ─────────────────────────────────────────────────────────────

describe('Settings – about section', () => {
  it('shows app version', async () => {
    const { getByText } = await renderWithTheme(<SettingsScreen />)
    expect(getByText(/Threadbase Mobile v1\.0\.0/)).toBeTruthy()
  })

  it('shows app tagline', async () => {
    const { getByText } = await renderWithTheme(<SettingsScreen />)
    expect(getByText('AI Agent Control Center')).toBeTruthy()
  })

  it('opens onboarding in explicit review mode', async () => {
    const { getByText } = await renderWithTheme(<SettingsScreen />)

    await fireEvent.press(getByText('Restart onboarding'))

    expect(mockPush).toHaveBeenCalledWith('/onboarding?mode=review')
  })
})

// ── Remove server flow ───────────────────────────────────────────────────────

describe('Settings – remove server flow', () => {
  it('shows Alert confirmation dialog when Delete server is pressed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const { getByLabelText } = await renderWithTheme(<SettingsScreen />)
    await fireEvent.press(getByLabelText('Delete server'))
    expect(alertSpy).toHaveBeenCalledWith(
      'Remove Server',
      expect.any(String),
      expect.any(Array)
    )
    alertSpy.mockRestore()
  })

  it('navigates to onboarding after removing last server', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const confirm = buttons?.find((b) => b.text === 'Remove')
      confirm?.onPress?.()
    })

    const { getByLabelText } = await renderWithTheme(<SettingsScreen />)

    await act(async () => {
      await fireEvent.press(getByLabelText('Delete server'))
    })

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding')
    })
  })

  it('does not navigate when Cancel is chosen', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const cancel = buttons?.find((b) => b.style === 'cancel')
      cancel?.onPress?.()
    })

    const { getByLabelText } = await renderWithTheme(<SettingsScreen />)
    await fireEvent.press(getByLabelText('Delete server'))

    await act(async () => {})
    expect(mockReplace).not.toHaveBeenCalled()
  })
})

describe('Settings – anonymous diagnostics section (spec §15)', () => {
  afterEach(async () => {
    await act(async () => {
      useSettingsStore.setState({ anonymousDiagnosticsEnabled: false })
    })
  })

  it('shows the toggle labeled Anonymous diagnostics, off by default', async () => {
    const { getAllByText, getByTestId } = await renderWithTheme(<SettingsScreen />)
    expect(getAllByText('Anonymous diagnostics').length).toBeGreaterThan(0)
    expect(getByTestId('settings-crash-reporting-toggle')).toBeTruthy()
    expect(useSettingsStore.getState().anonymousDiagnosticsEnabled).toBe(false)
  })

  it('toggling it on updates the settings store', async () => {
    const { getByTestId } = await renderWithTheme(<SettingsScreen />)
    await act(async () => {
      fireEvent(getByTestId('settings-crash-reporting-toggle'), 'valueChange', true)
    })
    expect(useSettingsStore.getState().anonymousDiagnosticsEnabled).toBe(true)
  })

  it('shows a Learn more disclosure explaining the random installation id', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const { getByTestId } = await renderWithTheme(<SettingsScreen />)
    await fireEvent.press(getByTestId('settings-diagnostics-learn-more'))
    expect(alertSpy).toHaveBeenCalledWith(
      'Anonymous diagnostics',
      expect.stringContaining('random installation ID'),
    )
    alertSpy.mockRestore()
  })
})

describe('Settings – session leave action', () => {
  it('shows When you leave a live session and can switch to Ask me', async () => {
    const { getByText, getByTestId } = await renderWithTheme(<SettingsScreen />)
    expect(getByText('When you leave a live session')).toBeTruthy()
    await fireEvent.press(getByTestId('settings-session-leave-action'))
    await fireEvent.press(getByTestId('settings-session-leave-kill'))
    expect(useSettingsStore.getState().sessionLeaveAction).toBe('kill')
    await fireEvent.press(getByTestId('settings-session-leave-ask'))
    expect(useSettingsStore.getState().sessionLeaveAction).toBe('ask')
  })

  it('turns the Keep running notice back on, and offers it only under Keep running', async () => {
    useSettingsStore.setState({ sessionLeaveAction: 'leave', skipLeaveNotice: true })
    const { getByTestId, queryByTestId, getByText } = await renderWithTheme(<SettingsScreen />)
    expect(getByText('Show the Keep running notice')).toBeTruthy()
    await fireEvent(getByTestId('settings-leave-notice-toggle'), 'valueChange', true)
    expect(useSettingsStore.getState().skipLeaveNotice).toBe(false)

    await fireEvent.press(getByTestId('settings-session-leave-action'))
    await fireEvent.press(getByTestId('settings-session-leave-ask'))
    expect(queryByTestId('settings-leave-notice-toggle')).toBeNull()
  })
})
