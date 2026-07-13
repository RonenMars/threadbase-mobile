/**
 * The analytics-consent checkbox on the final onboarding step drives
 * `crashReportingEnabled` in the settings store (default off → on → off).
 */
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { DoneStep } from '@/components/onboarding/steps/DoneStep'
import { useSettingsStore } from '@/stores/settings'

beforeEach(() => {
  useSettingsStore.setState({ crashReportingEnabled: false })
})

test('toggling the consent checkbox flips crashReportingEnabled', async () => {
  const { getByTestId } = await render(<DoneStep onEnter={jest.fn()} />)
  const checkbox = getByTestId('onboarding-analytics-consent')

  expect(useSettingsStore.getState().crashReportingEnabled).toBe(false)

  fireEvent.press(checkbox)
  await waitFor(() => expect(useSettingsStore.getState().crashReportingEnabled).toBe(true))

  fireEvent.press(checkbox)
  await waitFor(() => expect(useSettingsStore.getState().crashReportingEnabled).toBe(false))
})
