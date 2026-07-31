import * as Clipboard from 'expo-clipboard'
import * as MailComposer from 'expo-mail-composer'
import {
  renderReportText,
  submitFeedback,
  copyReportToClipboard,
  FEEDBACK_EMAIL,
} from '@/services/feedback-transport'
import { submitFeedbackViaSentry } from '@/services/sentry'
import type { FeedbackReport } from '@/types/feedback'

jest.mock('@/services/sentry', () => ({
  submitFeedbackViaSentry: jest.fn(),
}))

const baseReport = (): FeedbackReport => ({
  reportId: 'rep_123',
  category: 'bug',
  description: 'The hub flickers on cold launch.',
  email: 'me@example.com',
  diagnostics: {
    appVersion: '1.0.0',
    buildNumber: '162',
    platform: 'ios',
    osVersion: '18.2',
    jsEngine: 'hermes',
    environment: 'production',
    connectionMode: 'local',
    serverCount: 2,
    crashReportingEnabled: true,
  },
})

beforeEach(() => {
  jest.clearAllMocks()
  ;(MailComposer.isAvailableAsync as jest.Mock).mockResolvedValue(true)
  ;(MailComposer.composeAsync as jest.Mock).mockResolvedValue({ status: 'sent' })
})

describe('renderReportText', () => {
  it('includes category, description, email, and diagnostics rows', () => {
    const text = renderReportText(baseReport())
    expect(text).toContain('Bug report')
    expect(text).toContain('rep_123')
    expect(text).toContain('The hub flickers on cold launch.')
    expect(text).toContain('me@example.com')
    expect(text).toContain('appVersion: 1.0.0')
    expect(text).toContain('connectionMode: local')
  })

  it('omits the diagnostics block when not opted in', () => {
    const report = { ...baseReport(), diagnostics: undefined }
    const text = renderReportText(report)
    expect(text).not.toContain('Technical diagnostics')
    expect(text).not.toContain('appVersion')
  })

  it('never contains a URL, path, or credential', () => {
    // The report type structurally cannot hold these, but assert the rendered
    // text is clean as a defense-in-depth check.
    const text = renderReportText(baseReport())
    expect(/https?:\/\//.test(text)).toBe(false)
    expect(/\/Users\//.test(text)).toBe(false)
    expect(/tb_live/.test(text)).toBe(false)
  })
})

describe('submitFeedback — fallback chain', () => {
  it('uses Sentry when it returns an event id', async () => {
    ;(submitFeedbackViaSentry as jest.Mock).mockReturnValue('evt_fb')
    const result = await submitFeedback(baseReport())
    expect(result).toMatchObject({ ok: true, via: 'sentry', sentryEventId: 'evt_fb' })
    expect(MailComposer.composeAsync).not.toHaveBeenCalled()
  })

  it('includes diagnostics in the Sentry message when the user opted in', async () => {
    ;(submitFeedbackViaSentry as jest.Mock).mockReturnValue('evt_fb')
    await submitFeedback(baseReport())
    const opts = (submitFeedbackViaSentry as jest.Mock).mock.calls[0][0]
    expect(opts.message).toContain('Technical diagnostics')
    expect(opts.message).toContain('appVersion: 1.0.0')
  })

  it('omits diagnostics from the Sentry message when not opted in', async () => {
    ;(submitFeedbackViaSentry as jest.Mock).mockReturnValue('evt_fb')
    await submitFeedback({ ...baseReport(), diagnostics: undefined })
    const opts = (submitFeedbackViaSentry as jest.Mock).mock.calls[0][0]
    expect(opts.message).not.toContain('Technical diagnostics')
    expect(opts.message).not.toContain('appVersion')
  })

  it('falls back to email when Sentry is unavailable', async () => {
    ;(submitFeedbackViaSentry as jest.Mock).mockReturnValue(undefined)
    const result = await submitFeedback(baseReport())
    expect(result).toMatchObject({ ok: true, via: 'email' })
    expect(MailComposer.composeAsync).toHaveBeenCalledTimes(1)
  })

  it('passes the report in the email BODY, never a mailto query string', async () => {
    ;(submitFeedbackViaSentry as jest.Mock).mockReturnValue(undefined)
    await submitFeedback(baseReport())
    const opts = (MailComposer.composeAsync as jest.Mock).mock.calls[0][0]
    expect(opts.body).toContain('The hub flickers on cold launch.')
    // Asserts against the constant rather than a literal address, so changing the
    // inbox does not break the test. FEEDBACK_EMAIL falls back to SUPPORT_EMAIL
    // when EXPO_PUBLIC_FEEDBACK_EMAIL is unset, which is the case here — so this
    // pins the recipient, not the support/feedback split.
    expect(opts.recipients).toEqual([FEEDBACK_EMAIL])
  })

  it('returns ok:false (copy fallback) when Sentry and email both fail', async () => {
    ;(submitFeedbackViaSentry as jest.Mock).mockReturnValue(undefined)
    ;(MailComposer.isAvailableAsync as jest.Mock).mockResolvedValue(false)
    const result = await submitFeedback(baseReport())
    expect(result).toMatchObject({ ok: false, via: 'copy' })
  })

  it('returns copy fallback when the user cancels the email composer', async () => {
    ;(submitFeedbackViaSentry as jest.Mock).mockReturnValue(undefined)
    ;(MailComposer.composeAsync as jest.Mock).mockResolvedValue({ status: 'cancelled' })
    const result = await submitFeedback(baseReport())
    expect(result.ok).toBe(false)
  })
})

describe('copyReportToClipboard', () => {
  it('writes the rendered report to the clipboard', async () => {
    const ok = await copyReportToClipboard(baseReport())
    expect(ok).toBe(true)
    const written = (Clipboard.setStringAsync as jest.Mock).mock.calls[0][0]
    expect(written).toContain('The hub flickers on cold launch.')
  })
})
