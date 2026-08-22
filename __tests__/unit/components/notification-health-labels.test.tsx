/**
 * Notification health screen — label resolution.
 *
 * Every token state resolves its label through STATE_LABEL_KEYS; a wrong or
 * missing entry renders the raw key instead of copy, which no other suite
 * would catch.
 */
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import NotificationHealthScreen from '@/app/notification-health'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import { usePushHealth } from '@/hooks/usePushHealth'
import { registerPushToken } from '@/services/push'
import type { PushTokenHealth, PushTokenState } from '@/types/push-health'

jest.mock('@/hooks/usePushHealth', () => ({ usePushHealth: jest.fn() }))
jest.mock('@/services/push', () => ({
  isInQuietHours: jest.fn(() => false),
  registerPushToken: jest.fn(),
}))

const mockUsePushHealth = usePushHealth as jest.MockedFunction<typeof usePushHealth>
const mockRegisterPushToken = registerPushToken as jest.MockedFunction<typeof registerPushToken>
const refetch = jest.fn()

type HealthResult = ReturnType<typeof usePushHealth>

function token(state: PushTokenState): PushTokenHealth {
  return {
    platform: 'ios',
    deviceId: 'dev-1',
    registeredAt: 1_700_000_000_000,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFailureCode: null,
    failureStreak: 0,
    revokedAt: null,
    state,
  }
}

function setHealth(tokens: PushTokenHealth[]) {
  mockUsePushHealth.mockReturnValue({
    data: { available: true, tokens },
    error: null,
    isLoading: false,
    isFetching: false,
    refetch,
  } as unknown as HealthResult)
}

async function renderScreen() {
  return await render(
    <ThemeProvider>
      <NotificationHealthScreen />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  setHealth([])
  useServersStore.setState({
    servers: {
      srv_test: {
        id: 'srv_test',
        url: 'http://my-server.local:7070',
        apiKey: 'live-key',
        label: 'Dev Mac',
        isConnected: true,
        serverInfo: null,
        connectionError: null,
      },
    },
    activeServerIds: ['srv_test'],
    isLoading: false,
  })
  useSettingsStore.setState({
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

describe('NotificationHealthScreen – state labels', () => {
  const cases: [PushTokenState, string, string][] = [
    ['never-delivered', 'Never delivered', 'Registered, but no successful delivery yet (detection vs delivery).'],
    ['healthy', 'Healthy', 'Recent deliveries succeeded.'],
    ['failing', 'Failing', 'Delivery failures are accumulating on the server — re-register or check Expo credentials.'],
    ['dead', 'Dead', 'Delivery failures are accumulating on the server — re-register or check Expo credentials.'],
    ['revoked', 'Revoked', 'This token was revoked on the server.'],
  ]

  it.each(cases)('renders copy for %s', async (state, label, hint) => {
    setHealth([token(state)])
    const { getByText, queryByText } = await renderScreen()
    expect(getByText(label)).toBeTruthy()
    expect(getByText(hint)).toBeTruthy()
    expect(queryByText(`notificationHealth.state.${state}`)).toBeNull()
  })

  it('renders every state at once without falling back to raw keys', async () => {
    setHealth(cases.map(([state]) => token(state)))
    const { getByText, queryByText } = await renderScreen()
    for (const [state, label] of cases) {
      expect(getByText(label)).toBeTruthy()
      expect(queryByText(`notificationHealth.state.${state}`)).toBeNull()
    }
  })
})

describe('NotificationHealthScreen – screen states', () => {
  it('shows the empty state when no servers are active', async () => {
    useServersStore.setState({ servers: {}, activeServerIds: [] })
    const { getByText } = await renderScreen()
    expect(getByText('No servers yet')).toBeTruthy()
  })

  it('reports a permission-denied re-registration with the permission copy', async () => {
    mockRegisterPushToken.mockResolvedValue({ ok: false, reason: 'permission_denied' })
    const { getByTestId, getByText } = await renderScreen()
    fireEvent.press(getByTestId('notif-health-reregister'))
    await waitFor(() =>
      expect(
        getByText('Notifications permission is off — enable it in system settings, then retry.'),
      ).toBeTruthy(),
    )
  })

  it('reports an unavailable-token re-registration with the device copy', async () => {
    mockRegisterPushToken.mockResolvedValue({ ok: false, reason: 'token_unavailable' })
    const { getByTestId, getByText } = await renderScreen()
    fireEvent.press(getByTestId('notif-health-reregister'))
    await waitFor(() =>
      expect(
        getByText(
          'Could not get a push token (simulators cannot register). Try on a physical device.',
        ),
      ).toBeTruthy(),
    )
  })
})
