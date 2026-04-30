/**
 * E2E: Settings flow
 *
 * Tests the settings screen interactions: displaying server info, toggling
 * notification preferences, and the remove server confirmation flow.
 */
import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import { Alert } from 'react-native'
import SettingsScreen from '@/app/(tabs)/settings'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import * as SecureStore from 'expo-secure-store'

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
  it('displays the server URL', () => {
    const { getAllByText } = render(<SettingsScreen />)
    expect(getAllByText('http://my-server.local:7070').length).toBeGreaterThan(0)
  })

  it('displays server machine name', () => {
    const { getByText } = render(<SettingsScreen />)
    expect(getByText(/dev-mac/)).toBeTruthy()
  })

  it('displays server version', () => {
    const { getByText } = render(<SettingsScreen />)
    expect(getByText(/2\.1\.0/)).toBeTruthy()
  })

  it('shows Remove button', () => {
    const { getByText } = render(<SettingsScreen />)
    expect(getByText('Remove')).toBeTruthy()
  })

  it('shows Add Server button', () => {
    const { getByText } = render(<SettingsScreen />)
    expect(getByText('+ Add Server')).toBeTruthy()
  })

  it('opens add server flow from settings', () => {
    const { getByText } = render(<SettingsScreen />)
    fireEvent.press(getByText('+ Add Server'))
    expect(mockPush).toHaveBeenCalledWith('/onboarding?mode=add')
  })
})

// ── Notifications section ────────────────────────────────────────���────────────

describe('Settings – notifications section', () => {
  it('shows all notification toggle labels', () => {
    const { getByText } = render(<SettingsScreen />)
    expect(getByText('Waiting for Input')).toBeTruthy()
    expect(getByText('Session Completed')).toBeTruthy()
    expect(getByText('Session Failed')).toBeTruthy()
    expect(getByText('Diff Ready')).toBeTruthy()
    expect(getByText('Show Badge Count')).toBeTruthy()
    expect(getByText('Quiet Hours')).toBeTruthy()
  })

  it('shows Send Test Notification button', () => {
    const { getByText } = render(<SettingsScreen />)
    expect(getByText('Send Test Notification')).toBeTruthy()
  })

  it('calls scheduleNotificationAsync when test notification is pressed', async () => {
    const Notifications = require('expo-notifications')
    const { getByText } = render(<SettingsScreen />)

    await act(async () => {
      fireEvent.press(getByText('Send Test Notification'))
    })

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled()
  })
})

// ── About section ─────────────────────────────────────────────────────────────

describe('Settings – about section', () => {
  it('shows app version', () => {
    const { getByText } = render(<SettingsScreen />)
    expect(getByText(/Threadbase Mobile v1\.0\.0/)).toBeTruthy()
  })

  it('shows app tagline', () => {
    const { getByText } = render(<SettingsScreen />)
    expect(getByText('AI Agent Control Center')).toBeTruthy()
  })
})

// ── Remove server flow ───────────────────────────────────────────────────────

describe('Settings – remove server flow', () => {
  it('shows Alert confirmation dialog when Remove is pressed', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const { getByText } = render(<SettingsScreen />)
    fireEvent.press(getByText('Remove'))
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

    const { getByText } = render(<SettingsScreen />)

    await act(async () => {
      fireEvent.press(getByText('Remove'))
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

    const { getByText } = render(<SettingsScreen />)
    fireEvent.press(getByText('Remove'))

    await act(async () => {})
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
