/**
 * The two crash-test rows in Settings show in dev (Metro) and in enforced-tracking
 * QA builds, and stay hidden in TestFlight/store builds.
 */
import React from 'react'
import { render } from '@testing-library/react-native'
import SettingsScreen from '@/app/settings'
import { isSentryTrackingEnforced } from '@/services/sentry'

jest.mock('@/services/sentry', () => ({
  ...jest.requireActual('@/services/sentry'),
  isSentryTrackingEnforced: jest.fn(),
}))

const mockEnforced = isSentryTrackingEnforced as jest.Mock
const originalDev = (global as { __DEV__?: boolean }).__DEV__

const setDev = (value: boolean) => {
  ;(global as { __DEV__?: boolean }).__DEV__ = value
}

describe('settings crash-test rows', () => {
  afterEach(() => setDev(originalDev as boolean))

  it('shows both rows in an enforced-tracking QA build', async () => {
    setDev(false)
    mockEnforced.mockReturnValue(true)
    const screen = await render(<SettingsScreen />)
    expect(screen.queryByTestId('settings-test-crash-btn')).toBeTruthy()
    expect(screen.queryByTestId('settings-throw-uncaught-btn')).toBeTruthy()
  })

  it('hides both rows in a TestFlight/store build', async () => {
    setDev(false)
    mockEnforced.mockReturnValue(false)
    const screen = await render(<SettingsScreen />)
    expect(screen.queryByTestId('settings-test-crash-btn')).toBeNull()
    expect(screen.queryByTestId('settings-throw-uncaught-btn')).toBeNull()
  })

  it('shows both rows in dev even when tracking is not enforced', async () => {
    setDev(true)
    mockEnforced.mockReturnValue(false)
    const screen = await render(<SettingsScreen />)
    expect(screen.queryByTestId('settings-test-crash-btn')).toBeTruthy()
  })
})
