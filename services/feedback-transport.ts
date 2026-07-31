/**
 * FeedbackTransport — delivers a user-authored feedback report off the device.
 *
 * PRIVACY-CRITICAL PATH. The report body is built by `renderReportText`, which
 * emits ONLY: the user's own description + optional email (content they
 * explicitly typed and chose to submit) and the allowlisted diagnostics (build
 * constants + generic enums). It never includes prompts, terminal output,
 * paths, URLs, credentials, or session content, and the diagnostics block is
 * present only when the user opted in.
 *
 * Delivery is a three-tier fallback chain:
 *   1. Sentry User Feedback  — when crash reporting is active (consent + DSN).
 *   2. Native email composer — opens the user's mail app with the report body.
 *   3. Copy to clipboard     — the user copies and pastes into the feedback page.
 *
 * A configured HTTPS endpoint (EXPO_PUBLIC_FEEDBACK_ENDPOINT) takes precedence
 * over Sentry when present, for a future developer-operated backend.
 */

import * as Clipboard from 'expo-clipboard'
import * as MailComposer from 'expo-mail-composer'
import { submitFeedbackViaSentry } from './sentry'
import { diagnosticsToRows } from './feedback-diagnostics'
import { sanitize } from './sanitize'
import type {
  FeedbackReport,
  FeedbackSubmitResult,
  FeedbackTransportKind,
} from '@/types/feedback'

/**
 * Support address used for the email fallback.
 *
 * Overridable so a fork or a white-label build can point support at its own inbox
 * without patching source. The literal stays as the default rather than requiring
 * the variable: unset, an override-only version would open a composer with no
 * recipient — a silent failure the user only discovers after writing the message.
 */
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'ronenmars@gmail.com'
/** Public feedback page users are pointed to for the copy-and-paste fallback. */
export const FEEDBACK_PAGE_URL = 'https://www.threadbase.sh/feedback'

/** Optional configured HTTPS endpoint for a future developer-operated backend. */
const FEEDBACK_ENDPOINT = process.env.EXPO_PUBLIC_FEEDBACK_ENDPOINT

const CATEGORY_LABEL: Record<FeedbackReport['category'], string> = {
  bug: 'Bug report',
  feature: 'Feature request',
  general: 'General feedback',
}

/**
 * Render a feedback report to a safe plaintext block for the email body and the
 * copy fallback. Contains only user-authored content + allowlisted diagnostics.
 * The description is length-capped but not shape-redacted (the user chose to
 * submit it). Never place this in a mailto: query string — always the body.
 */
export function renderReportText(report: FeedbackReport): string {
  const lines: string[] = []
  lines.push(`Threadbase feedback — ${CATEGORY_LABEL[report.category]}`)
  lines.push(`Report ID: ${report.reportId}`)
  lines.push('')
  lines.push('Description:')
  lines.push(report.description.trim().slice(0, 4000))
  if (report.email?.trim()) {
    lines.push('')
    lines.push(`Reply to: ${report.email.trim().slice(0, 254)}`)
  }
  if (report.diagnostics) {
    lines.push('')
    lines.push('Technical diagnostics (sanitized):')
    for (const row of diagnosticsToRows(report.diagnostics)) {
      lines.push(`  ${row.key}: ${row.value}`)
    }
  }
  return lines.join('\n')
}

function emailSubject(report: FeedbackReport): string {
  return `Threadbase feedback: ${CATEGORY_LABEL[report.category]} (${report.reportId})`
}

/** Attempt Sentry User Feedback. Returns an event id on success. */
async function trySentry(report: FeedbackReport): Promise<string | undefined> {
  const lines = [report.description.trim().slice(0, 4000)]
  if (report.diagnostics) {
    lines.push('', 'Technical diagnostics (sanitized):')
    for (const row of diagnosticsToRows(report.diagnostics)) {
      lines.push(`  ${row.key}: ${row.value}`)
    }
  }
  return submitFeedbackViaSentry({
    message: lines.join('\n'),
    email: report.email,
    category: report.category,
    attachment: report.attachment
      ? { uri: report.attachment.uri, mimeType: report.attachment.mimeType }
      : undefined,
  })
}

/** Attempt a configured HTTPS endpoint. Returns true on a 2xx response. */
async function tryEndpoint(report: FeedbackReport): Promise<boolean> {
  if (!FEEDBACK_ENDPOINT || !FEEDBACK_ENDPOINT.startsWith('https://')) return false
  try {
    // Defense in depth: the diagnostics struct is already an allowlist, but we
    // pass it through the central sanitizer before it leaves the device so a
    // future field that inadvertently carries a URL/path/id cannot ship
    // unscrubbed over a configured endpoint. description/email are user-authored
    // content the user chose to submit, so they are sent as-is (length-capped).
    const res = await fetch(FEEDBACK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        reportId: report.reportId,
        category: report.category,
        description: report.description.slice(0, 4000),
        email: report.email?.slice(0, 254),
        diagnostics: report.diagnostics ? sanitize(report.diagnostics) : undefined,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Attempt the native mail composer. Returns true only when the user actually
 * sent (status 'sent'). A screenshot attachment is included when present.
 */
async function tryEmail(report: FeedbackReport): Promise<boolean> {
  try {
    const available = await MailComposer.isAvailableAsync()
    if (!available) return false
    const result = await MailComposer.composeAsync({
      recipients: [SUPPORT_EMAIL],
      subject: emailSubject(report),
      body: renderReportText(report),
      attachments: report.attachment ? [report.attachment.uri] : undefined,
    })
    return result.status === MailComposer.MailComposerStatus.SENT
  } catch {
    return false
  }
}

/**
 * Copy the report text to the clipboard. Always available; the last-resort
 * fallback. The caller then guides the user to paste it into the feedback page.
 */
export async function copyReportToClipboard(report: FeedbackReport): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(renderReportText(report))
    return true
  } catch {
    return false
  }
}

export interface SubmitOptions {
  /** Preferred order of transports. Defaults to endpoint → sentry → email. */
  preferredOrder?: FeedbackTransportKind[]
}

/**
 * Submit a feedback report through the fallback chain. Tries a configured
 * endpoint, then Sentry, then the email composer. If all network/composer paths
 * are unavailable or declined, the caller should offer the copy fallback via
 * `copyReportToClipboard`.
 *
 * @returns a result describing which transport succeeded, or ok:false to signal
 *          the caller should present the copy fallback.
 */
export async function submitFeedback(
  report: FeedbackReport,
  _options: SubmitOptions = {},
): Promise<FeedbackSubmitResult> {
  // 1. Configured HTTPS endpoint (future developer-operated backend).
  if (await tryEndpoint(report)) {
    return { ok: true, via: 'sentry', reportId: report.reportId }
  }

  // 2. Sentry User Feedback (only when crash reporting is active).
  const sentryId = await trySentry(report)
  if (sentryId) {
    return { ok: true, via: 'sentry', reportId: report.reportId, sentryEventId: sentryId }
  }

  // 3. Native email composer.
  if (await tryEmail(report)) {
    return { ok: true, via: 'email', reportId: report.reportId }
  }

  // No automatic transport succeeded — caller falls back to copy + guide.
  return { ok: false, via: 'copy', reportId: report.reportId }
}
