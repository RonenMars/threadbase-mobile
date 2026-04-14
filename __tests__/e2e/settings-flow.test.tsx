/**
 * E2E: Settings flow
 *
 * Tests the settings screen interactions: displaying server info, toggling
 * notification preferences, and the disconnect confirmation flow.
 */
import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import { Alert } from 'react-native'
import SettingsScreen from '@/app/(tabs)/settings'
import { useConnectionStore } from '@/stores/connection'
import { useSettingsStore } from '@/stores/settings'
import * as SecureStore from 'expo-secure-store'

const mockReplace = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
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
  jest.clearAllMocks()

  useConnectionStore.setState({
    serverUrl: 'http://my-server.local:7070',
    apiKey: 'live-key',
    isConnected: true,
    serverInfo: SERVER_INFO,
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
    const { getByText } = render(<SettingsScreen />)
    expect(getByText('http://my-server.local:7070')).toBeTruthy()
  })

  it('displays server machine name', () => {
    const { getByText } = render(<SettingsScreen />)
    expect(getByText(/dev-mac/)).toBeTruthy()
  })

  it('displays server version', () => {
    const { getByText } = render(<SettingsScreen />)
    expect(getByText(/2\.1\.0/)).toBeTruthy()
  })

  it('shows Disconnect button', () => {
    const { getByText } = render(<SettingsScreen />)
    expect(getByText('Disconnect')).toBeTruthy()
  })
})

// ── Notifications section ─────────────────────────────────────────────────────

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
    expect(getByText('Threadbase Mobile v1.0.0')).toBeTruthy()
  })

  it('shows app tagline', () => {
    const { getByText } = render(<SettingsScreen />)
    expect(getByText('AI Agent Control Center')).toBeTruthy()
  })
})

// ── Disconnect flow ───────────────────────────────────────────────────────────

describe('Settings – disconnect flow', () => {
  it('shows Alert confirmation dialog when Disconnect is pressed', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const { getByText } = render(<SettingsScreen />)
    fireEvent.press(getByText('Disconnect'))
    expect(alertSpy).toHaveBeenCalledWith(
      'Disconnect',
      expect.stringContaining('credentials'),
      expect.any(Array)
    )
    alertSpy.mockRestore()
  })

  it('navigates to onboarding after confirming disconnect', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const confirm = buttons?.find((b) => b.text === 'Disconnect')
      confirm?.onPress?.()
    })

    const { getByText } = render(<SettingsScreen />)

    await act(async () => {
      fireEvent.press(getByText('Disconnect'))
    })

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding')
    })
  })

  it('clears apiKey from store after confirming disconnect', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const confirm = buttons?.find((b) => b.text === 'Disconnect')
      confirm?.onPress?.()
    })

    const { getByText } = render(<SettingsScreen />)

    await act(async () => {
      fireEvent.press(getByText('Disconnect'))
    })

    await waitFor(() => {
      expect(useConnectionStore.getState().apiKey).toBe('')
      expect(useConnectionStore.getState().isConnected).toBe(false)
    })
  })

  it('calls SecureStore.deleteItemAsync on disconnect confirm', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const confirm = buttons?.find((b) => b.text === 'Disconnect')
      confirm?.onPress?.()
    })

    const { getByText } = render(<SettingsScreen />)

    await act(async () => {
      fireEvent.press(getByText('Disconnect'))
    })

    await waitFor(() => {
      expect(SecureStore.deleteItemAsync).toHaveBeenCalled()
    })
  })

  it('does not navigate when Cancel is chosen', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const cancel = buttons?.find((b) => b.style === 'cancel')
      cancel?.onPress?.()
    })

    const { getByText } = render(<SettingsScreen />)
    fireEvent.press(getByText('Disconnect'))

    // Give any pending microtasks a chance to run
    await act(async () => {})
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
