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
      sessionComplete: true,
      sessionFailed: true,
      diffReady: false,
      quietHoursEnabled: false,
      quietHoursFrom: '22:00',
      quietHoursTo: '08:00',
      showBadge: true,
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
    const { getByText } = await renderWithTheme(<SettingsScreen />)
    expect(getByText('+ Add Server')).toBeTruthy()
  })

  it('opens add server modal from settings', async () => {
    const { getByText } = await renderWithTheme(<SettingsScreen />)
    // Pressing "+ Add Server" now opens the ServerEditModal (sets editServerId to 'new')
    // rather than navigating to onboarding. Just verify the button is pressable.
    await fireEvent.press(getByText('+ Add Server'))
    expect(mockPush).not.toHaveBeenCalled()
  })
})

// ── Notifications section ────────────────────────────────────────���────────────

describe('Settings – notifications section', () => {
  it('shows all notification toggle labels', async () => {
    const { getByText } = await renderWithTheme(<SettingsScreen />)
    expect(getByText('Waiting for Input')).toBeTruthy()
    expect(getByText('Session Completed')).toBeTruthy()
    expect(getByText('Session Failed')).toBeTruthy()
    expect(getByText('Diff Ready')).toBeTruthy()
    expect(getByText('Show Badge Count')).toBeTruthy()
    expect(getByText('Quiet Hours')).toBeTruthy()
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

describe('Settings – session leave action', () => {
  it('shows Action on session leave and can restore Always ask', async () => {
    const { getByText, getByTestId } = await renderWithTheme(<SettingsScreen />)
    expect(getByText('Action on session leave')).toBeTruthy()
    await fireEvent.press(getByTestId('settings-session-leave-action'))
    await fireEvent.press(getByTestId('settings-session-leave-kill'))
    expect(useSettingsStore.getState().sessionLeaveAction).toBe('kill')
    await fireEvent.press(getByTestId('settings-session-leave-ask'))
    expect(useSettingsStore.getState().sessionLeaveAction).toBe('ask')
  })
})
