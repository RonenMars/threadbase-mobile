/**
 * E2E: Help & Feedback flow.
 *
 * Exercises the landing → form → submit journey, validation, diagnostics
 * opt-in/preview, screenshot add/remove, the transport fallback chain, and the
 * privacy-policy link — without sending any real report (transport is mocked).
 *
 * Note: under React 19 + RNTL 14, controlled-input updates from
 * fireEvent.changeText only flush when wrapped in act(); the `type` helper below
 * does that so component state is settled before the next interaction.
 */
import React from 'react'
import { render, fireEvent, waitFor, act, cleanup, type RenderResult } from '@testing-library/react-native'
import { Linking } from 'react-native'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/test-utils/i18n-setup'
import { ThemeProvider } from '@/contexts/ThemeContext'
import HelpFeedbackScreen from '@/app/help-feedback'
import { submitFeedback, copyReportToClipboard } from '@/services/feedback-transport'
import { pickAndPrepareScreenshot } from '@/services/feedback-screenshot'

jest.mock('@/services/feedback-transport', () => ({
  submitFeedback: jest.fn(),
  copyReportToClipboard: jest.fn().mockResolvedValue(true),
  FEEDBACK_PAGE_URL: 'https://www.threadbase.sh/feedback',
  SUPPORT_EMAIL: 'ronenmars@gmail.com',
}))
jest.mock('@/services/feedback-screenshot', () => ({
  pickAndPrepareScreenshot: jest.fn(),
}))
jest.mock('@/services/sentry', () => ({
  addSafeBreadcrumb: jest.fn(),
}))
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}))

type Screen = Awaited<RenderResult>

async function renderScreen(): Promise<Screen> {
  const screen = await render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <HelpFeedbackScreen />
      </ThemeProvider>
    </I18nextProvider>,
  )
  await waitFor(() => expect(screen.getByTestId('feedback-landing-bug')).toBeTruthy())
  return screen
}

async function gotoForm(screen: Screen, category = 'bug') {
  fireEvent.press(screen.getByTestId(`feedback-landing-${category}`))
  await waitFor(() => expect(screen.getByTestId('feedback-description-input')).toBeTruthy())
}

async function type(screen: Screen, testID: string, value: string) {
  await act(async () => {
    fireEvent.changeText(screen.getByTestId(testID), value)
  })
}

async function press(screen: Screen, testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID))
  })
}

const VALID_DESC = 'A perfectly valid description here'

beforeEach(() => {
  jest.clearAllMocks()
  ;(submitFeedback as jest.Mock).mockResolvedValue({ ok: true, via: 'sentry', reportId: 'rep_x' })
})

afterEach(() => cleanup())

describe('Help & Feedback — landing', () => {
  it('shows all entry points', async () => {
    const screen = await renderScreen()
    expect(screen.getByTestId('feedback-landing-bug')).toBeTruthy()
    expect(screen.getByTestId('feedback-landing-feature')).toBeTruthy()
    expect(screen.getByTestId('feedback-landing-general')).toBeTruthy()
    expect(screen.getByTestId('feedback-landing-privacy')).toBeTruthy()
    expect(screen.getByTestId('feedback-landing-support')).toBeTruthy()
  })

  it('opens the privacy policy link', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never)
    const screen = await renderScreen()
    await press(screen, 'feedback-landing-privacy')
    expect(spy).toHaveBeenCalledWith('https://threadbase.sh/privacy-policy')
    spy.mockRestore()
  })
})

describe('Help & Feedback — categories', () => {
  it.each(['bug', 'feature', 'general'])('opens the form for %s', async (cat) => {
    const screen = await renderScreen()
    await gotoForm(screen, cat)
    expect(screen.getByTestId('feedback-description-input')).toBeTruthy()
    expect(screen.getByTestId(`feedback-category-${cat}`)).toBeTruthy()
  })
})

describe('Help & Feedback — validation', () => {
  it('rejects an empty description', async () => {
    const screen = await renderScreen()
    await gotoForm(screen)
    await press(screen, 'feedback-submit')
    await waitFor(() => expect(screen.getByText(/something to debug/i)).toBeTruthy())
    expect(submitFeedback).not.toHaveBeenCalled()
  })

  it('rejects a too-short description', async () => {
    const screen = await renderScreen()
    await gotoForm(screen)
    await type(screen, 'feedback-description-input', 'short')
    await press(screen, 'feedback-submit')
    await waitFor(() => expect(screen.getByText(/few more characters/i)).toBeTruthy())
    expect(submitFeedback).not.toHaveBeenCalled()
  })

  it('rejects an invalid email', async () => {
    const screen = await renderScreen()
    await gotoForm(screen)
    await type(screen, 'feedback-description-input', VALID_DESC)
    await type(screen, 'feedback-email-input', 'not-an-email')
    await press(screen, 'feedback-submit')
    await waitFor(() => expect(screen.getByText(/doesn't look quite right/i)).toBeTruthy())
    expect(submitFeedback).not.toHaveBeenCalled()
  })

  it('accepts a valid description + no email', async () => {
    const screen = await renderScreen()
    await gotoForm(screen)
    await type(screen, 'feedback-description-input', VALID_DESC)
    await press(screen, 'feedback-submit')
    await waitFor(() => expect(submitFeedback).toHaveBeenCalledTimes(1))
  })
})

describe('Help & Feedback — diagnostics opt-in', () => {
  it('allows the diagnostics toggle to receive the first tap after text entry', async () => {
    const screen = await renderScreen()
    await gotoForm(screen)
    expect(JSON.stringify(screen.toJSON())).toContain('"keyboardShouldPersistTaps":"handled"')
  })

  it('shows the diagnostics preview by default and can toggle detail', async () => {
    const screen = await renderScreen()
    await gotoForm(screen)
    expect(screen.getByTestId('feedback-diagnostics-toggle')).toBeTruthy()
    expect(screen.queryByTestId('feedback-diagnostics-rows')).toBeNull()
    await press(screen, 'feedback-diagnostics-toggle')
    expect(screen.getByTestId('feedback-diagnostics-rows')).toBeTruthy()
  })

  it('hides the diagnostics preview when opted out', async () => {
    const screen = await renderScreen()
    await gotoForm(screen)
    await press(screen, 'feedback-include-diagnostics')
    expect(screen.queryByTestId('feedback-diagnostics-toggle')).toBeNull()
  })

  it('submits WITHOUT diagnostics when opted out', async () => {
    const screen = await renderScreen()
    await gotoForm(screen)
    await type(screen, 'feedback-description-input', VALID_DESC)
    await press(screen, 'feedback-include-diagnostics')
    await press(screen, 'feedback-submit')
    await waitFor(() => expect(submitFeedback).toHaveBeenCalled())
    const report = (submitFeedback as jest.Mock).mock.calls[0][0]
    expect(report.diagnostics).toBeUndefined()
  })

  it('submits WITH diagnostics when opted in (default)', async () => {
    const screen = await renderScreen()
    await gotoForm(screen)
    await type(screen, 'feedback-description-input', VALID_DESC)
    await press(screen, 'feedback-submit')
    await waitFor(() => expect(submitFeedback).toHaveBeenCalled())
    const report = (submitFeedback as jest.Mock).mock.calls[0][0]
    expect(report.diagnostics).toBeDefined()
    expect(report.diagnostics.appVersion).toBe('1.0.0')
  })
})

describe('Help & Feedback — screenshot', () => {
  it('adds and removes a screenshot', async () => {
    ;(pickAndPrepareScreenshot as jest.Mock).mockResolvedValue({
      uri: 'file:///tmp/shot.jpg', mimeType: 'image/jpeg', sizeBytes: 100000,
    })
    const screen = await renderScreen()
    await gotoForm(screen)
    await press(screen, 'feedback-add-screenshot')
    await waitFor(() => expect(screen.getByTestId('feedback-remove-screenshot')).toBeTruthy())
    await press(screen, 'feedback-remove-screenshot')
    expect(screen.queryByTestId('feedback-remove-screenshot')).toBeNull()
    expect(screen.getByTestId('feedback-add-screenshot')).toBeTruthy()
  })
})

describe('Help & Feedback — submission states', () => {
  it('shows success after a successful submit', async () => {
    const screen = await renderScreen()
    await gotoForm(screen)
    await type(screen, 'feedback-description-input', VALID_DESC)
    await press(screen, 'feedback-submit')
    await waitFor(() => expect(screen.getByTestId('feedback-success-done')).toBeTruthy())
  })

  it('falls back to copy flow when transport returns ok:false', async () => {
    ;(submitFeedback as jest.Mock).mockResolvedValue({ ok: false, via: 'copy', reportId: 'rep_x' })
    const screen = await renderScreen()
    await gotoForm(screen)
    await type(screen, 'feedback-description-input', VALID_DESC)
    await press(screen, 'feedback-submit')
    await waitFor(() => expect(screen.getByTestId('feedback-copy-report')).toBeTruthy())
  })

  it('copies the report in the fallback flow', async () => {
    ;(submitFeedback as jest.Mock).mockResolvedValue({ ok: false, via: 'copy', reportId: 'rep_x' })
    const screen = await renderScreen()
    await gotoForm(screen)
    await type(screen, 'feedback-description-input', VALID_DESC)
    await press(screen, 'feedback-submit')
    await waitFor(() => expect(screen.getByTestId('feedback-copy-report')).toBeTruthy())
    await press(screen, 'feedback-copy-report')
    expect(copyReportToClipboard).toHaveBeenCalled()
  })

  it('prevents duplicate submits while a submit is in flight', async () => {
    let resolveSubmit: (v: unknown) => void = () => {}
    ;(submitFeedback as jest.Mock).mockReturnValue(new Promise((r) => { resolveSubmit = r }))
    const screen = await renderScreen()
    await gotoForm(screen)
    await type(screen, 'feedback-description-input', VALID_DESC)
    await press(screen, 'feedback-submit')
    await press(screen, 'feedback-submit') // second press while pending
    expect((submitFeedback as jest.Mock).mock.calls.length).toBe(1)
    await act(async () => { resolveSubmit({ ok: true, via: 'sentry', reportId: 'rep_x' }) })
  })
})
