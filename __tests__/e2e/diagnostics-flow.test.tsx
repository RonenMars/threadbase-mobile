/**
 * E2E: Diagnostics screen.
 *
 * Verifies the screen loads a report, renders the preview and the
 * included/excluded/control disclosures, and that Copy/Share invoke the
 * expected APIs. No sensitive data is asserted here beyond the leakage tests in
 * services/diagnostics.test.ts — this covers the UI wiring.
 */
import React from 'react'
import { render, fireEvent, waitFor, act, cleanup, type RenderResult } from '@testing-library/react-native'
import { Share } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/test-utils/i18n-setup'
import { ThemeProvider } from '@/contexts/ThemeContext'
import DiagnosticsScreen from '@/app/diagnostics'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}))

type Screen = Awaited<RenderResult>

async function renderScreen(): Promise<Screen> {
  const screen = await render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <DiagnosticsScreen />
      </ThemeProvider>
    </I18nextProvider>,
  )
  await waitFor(() => expect(screen.getByTestId('diagnostics-preview')).toBeTruthy())
  return screen
}

async function press(screen: Screen, testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID))
  })
}

beforeEach(() => jest.clearAllMocks())
afterEach(() => cleanup())

describe('Diagnostics screen', () => {
  it('renders the preview and copy/share actions after loading', async () => {
    const screen = await renderScreen()
    expect(screen.getByTestId('diagnostics-preview')).toBeTruthy()
    expect(screen.getByTestId('diagnostics-copy')).toBeTruthy()
    expect(screen.getByTestId('diagnostics-share')).toBeTruthy()
  })

  it('shows the included / excluded disclosures', async () => {
    const screen = await renderScreen()
    expect(screen.getByText(/What's included/i)).toBeTruthy()
    expect(screen.getByText(/What's not included/i)).toBeTruthy()
  })

  it('copies diagnostics text to the clipboard', async () => {
    const screen = await renderScreen()
    await press(screen, 'diagnostics-copy')
    expect(Clipboard.setStringAsync).toHaveBeenCalled()
    const written = (Clipboard.setStringAsync as jest.Mock).mock.calls[0][0]
    expect(written).toContain('Threadbase diagnostics')
    expect(written).toContain('appVersion')
  })

  it('opens the native share sheet with the diagnostics text', async () => {
    const spy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never)
    const screen = await renderScreen()
    await press(screen, 'diagnostics-share')
    expect(spy).toHaveBeenCalled()
    const arg = spy.mock.calls[0][0] as { message: string }
    expect(arg.message).toContain('Threadbase diagnostics')
    spy.mockRestore()
  })
})
