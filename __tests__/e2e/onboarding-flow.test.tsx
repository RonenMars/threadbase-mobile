/**
 * E2E: Add-server flow
 *
 * Tests the add-server form (rendered via /onboarding?mode=add): rendering,
 * input, API validation, error handling, and navigation on success. The
 * first-launch onboarding flow has its own dedicated suite.
 */
import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import OnboardingScreen from '@/app/onboarding'

const mockReplace = jest.fn()
const mockSetOptions = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => ({ mode: 'add' }),
  useNavigation: () => ({ setOptions: mockSetOptions }),
}))

// Mock the servers store so addServer doesn't use a dynamic import()
const mockAddServer = jest.fn().mockResolvedValue('srv_test')
jest.mock('@/stores/servers', () => ({
  useServersStore: jest.fn(() => ({
    addServer: mockAddServer,
    servers: {},
    activeServerIds: [],
    displayedServerIds: [],
    setDisplayedServerIds: jest.fn(),
    isLoading: false,
  })),
}))

const mockFetch = jest.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockReset()
  mockReplace.mockReset()
  mockSetOptions.mockReset()
  mockAddServer.mockReset().mockResolvedValue('srv_test')
})

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('Onboarding – initial render', () => {
  it('displays app title', async () => {
    const { getByText } = await render(<OnboardingScreen />)
    expect(getByText('Threadbase')).toBeTruthy()
  })

  it('shows Server URL input', async () => {
    const { getByPlaceholderText } = await render(<OnboardingScreen />)
    expect(getByPlaceholderText('192.168.x.x:8766')).toBeTruthy()
  })

  it('shows API key input', async () => {
    const { getByPlaceholderText } = await render(<OnboardingScreen />)
    expect(getByPlaceholderText('Paste your API token here')).toBeTruthy()
  })

  it('shows Connect button', async () => {
    const { getByText } = await render(<OnboardingScreen />)
    expect(getByText('Connect')).toBeTruthy()
  })

  it('shows Hide toggle (DEV mode shows key by default)', async () => {
    const { getByText } = await render(<OnboardingScreen />)
    expect(getByText('Hide')).toBeTruthy()
  })

  it('shows the cch hint text', async () => {
    const { getByText } = await render(<OnboardingScreen />)
    expect(getByText(/cch serve/)).toBeTruthy()
  })

  it('shows optional Label field', async () => {
    const { getByPlaceholderText } = await render(<OnboardingScreen />)
    expect(getByPlaceholderText(/Work Mac/)).toBeTruthy()
  })
})

// ── Toggle ────────────────────────────────────────────────────────────────────

describe('Onboarding – API key visibility toggle', () => {
  it('switches from Hide to Show when pressed', async () => {
    const { getByText } = await render(<OnboardingScreen />)
    await fireEvent.press(getByText('Hide'))
    expect(getByText('Show')).toBeTruthy()
  })

  it('switches back to Hide when pressed again', async () => {
    const { getByText } = await render(<OnboardingScreen />)
    await fireEvent.press(getByText('Hide'))
    await fireEvent.press(getByText('Show'))
    expect(getByText('Hide')).toBeTruthy()
  })
})

// ── Successful connection ─────────────────────────────────────────────────────

describe('Onboarding – successful connection', () => {
  it('navigates to sessions tab after successful connect', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue([]),
    })

    const { getByText, getByPlaceholderText } = await render(<OnboardingScreen />)

    await fireEvent.changeText(getByPlaceholderText('192.168.x.x:8766'), '192.168.1.100:7070')
    await fireEvent.changeText(getByPlaceholderText('Paste your API token here'), 'valid-key')

    await act(async () => {
      await fireEvent.press(getByText('Connect'))
    })

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/')
    }, { timeout: 10000 })
  }, 15000)
})

// ── Error states ──────────────────────────────────────────────────────────────

describe('Onboarding – error handling', () => {
  it('shows auth error message on 401 response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: jest.fn().mockResolvedValue({}) })

    const { getByText, getByPlaceholderText, findByText } = await render(<OnboardingScreen />)

    await fireEvent.changeText(getByPlaceholderText('192.168.x.x:8766'), '192.168.1.1:7070')
    await fireEvent.changeText(getByPlaceholderText('Paste your API token here'), 'wrong-key')

    await act(async () => {
      await fireEvent.press(getByText('Connect'))
    })

    expect(await findByText(/Invalid API key/)).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('shows generic network error for non-localhost URL', async () => {
    mockFetch.mockRejectedValue(new TypeError('Network request failed'))

    const { getByText, getByPlaceholderText, findByText } = await render(<OnboardingScreen />)

    await fireEvent.changeText(getByPlaceholderText('192.168.x.x:8766'), '192.168.1.1:7070')
    await fireEvent.changeText(getByPlaceholderText('Paste your API token here'), 'some-key')

    await act(async () => {
      await fireEvent.press(getByText('Connect'))
    })

    expect(await findByText(/Could not reach the server/)).toBeTruthy()
  })

  it('shows localhost-specific warning when URL contains localhost', async () => {
    mockFetch.mockRejectedValue(new TypeError('Network request failed'))

    const { getByText, getByPlaceholderText, findByText } = await render(<OnboardingScreen />)

    // Keep default localhost URL, just add API key
    await fireEvent.changeText(getByPlaceholderText('Paste your API token here'), 'some-key')

    await act(async () => {
      await fireEvent.press(getByText('Connect'))
    })

    expect(await findByText(/localhost/)).toBeTruthy()
  })

  it('shows network error on 500 response (non-ok is treated as network error)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: jest.fn().mockResolvedValue({}) })

    const { getByText, getByPlaceholderText, findByText } = await render(<OnboardingScreen />)

    await fireEvent.changeText(getByPlaceholderText('192.168.x.x:8766'), '192.168.1.1:7070')
    await fireEvent.changeText(getByPlaceholderText('Paste your API token here'), 'key')

    await act(async () => {
      await fireEvent.press(getByText('Connect'))
    })

    // Non-ok responses throw NetworkError which shows the generic network message
    expect(await findByText(/Could not reach the server/)).toBeTruthy()
  })
})

// ── First-launch flow ─────────────────────────────────────────────────────────

describe('Onboarding – first-launch flow', () => {
  it('TOTAL_STEPS is 4', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { TOTAL_STEPS } = require('@/components/onboarding/OnboardingNavigator')
    expect(TOTAL_STEPS).toBe(4)
  })
})
