import type { TFunction } from 'i18next'

/** How a classified error should be surfaced. `blocking` is not wired into any
 * consumer yet — see the "Where to Use Option 1" deferral note in ErrorBanner. */
export type ErrorPresentation = 'inline' | 'recovery-sheet' | 'blocking'

export interface ClassifiedError {
  /** Friendly explanation of *why*, when the status/code says something more specific than a generic failure. */
  description?: string
  /** Machine-facing identifier for the technical-details row — an HTTP status or a server error code. */
  code?: string
  presentation: ErrorPresentation
  retryable: boolean
}

const TRANSIENT_STATUSES = new Set([429, 502, 503, 504])

function statusOf(error: unknown): number | undefined {
  return error && typeof error === 'object' && 'status' in error
    ? (error as { status?: number }).status
    : undefined
}

function codeOf(error: unknown): string | undefined {
  return error && typeof error === 'object' && 'code' in error
    ? (error as { code?: string }).code
    : undefined
}

function nameOf(error: unknown): string | undefined {
  if (error instanceof Error) return error.name
  return error && typeof error === 'object' && 'name' in error
    ? (error as { name?: string }).name
    : undefined
}

/** Transient failures worth an automatic retry before escalating to the user. */
export function isTransientError(error: unknown): boolean {
  const status = statusOf(error)
  if (status !== undefined) return TRANSIENT_STATUSES.has(status)
  return codeOf(error) === 'TIMEOUT'
}

/**
 * Maps a raw fetch/API error to a presentation classification. Deliberately
 * does not decide title/message wording for query-category failures — those
 * stay the existing per-category copy in ErrorBanner, which already carries
 * more context (which screen section failed) than a status code alone can.
 * This only supplies what the status/code adds: a more specific description
 * when one exists, plus the technical code for the details row.
 */
export function classifyError(error: unknown, t: TFunction<'common'>): ClassifiedError {
  const status = statusOf(error)
  const code = codeOf(error)
  const name = nameOf(error)

  if (name === 'AuthError' || status === 401) {
    return { description: t('errorPolicy.sessionExpired'), code: code ?? 'HTTP_401', presentation: 'blocking', retryable: false }
  }
  if (status === 403) {
    return { description: t('errorPolicy.forbidden'), code: 'HTTP_403', presentation: 'blocking', retryable: false }
  }
  if (status === 404) {
    return { description: t('errorPolicy.notFound'), code: 'HTTP_404', presentation: 'recovery-sheet', retryable: false }
  }
  if (code === 'TIMEOUT') {
    return { description: t('errorPolicy.timeout'), code, presentation: 'recovery-sheet', retryable: true }
  }
  if (status === 429) {
    return { description: t('errorPolicy.tooManyRequests'), code: 'HTTP_429', presentation: 'recovery-sheet', retryable: true }
  }
  if (status !== undefined && status >= 500) {
    return { description: t('errorPolicy.serverError'), code: `HTTP_${status}`, presentation: 'recovery-sheet', retryable: true }
  }
  return {
    code: code ?? (status !== undefined ? `HTTP_${status}` : undefined),
    presentation: 'recovery-sheet',
    retryable: true,
  }
}
