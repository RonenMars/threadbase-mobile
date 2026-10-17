import type { TFunction } from 'i18next'
import { useQueryRecoveryStore } from '@/stores/query-recovery'

/** How a classified error should be surfaced. `blocking` (401/403) is
 * excluded from the Status sheet and raised as a CriticalDialog. */
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

/** Outer RQ schedule: first silent retry after 2s, second after 1s. */
export const QUERY_RETRY_DELAYS_MS = [2000, 1000] as const
/** Single short gate for 401/403 before CriticalDialog. */
export const AUTH_RETRY_DELAY_MS = 1500
/** Max outer RQ retries for ordinary query failures (not 401/403). */
export const QUERY_RETRY_COUNT = 2
/** Max outer RQ retries for 401/403. */
export const AUTH_RETRY_COUNT = 1

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

function isNotFoundError(error: unknown): boolean {
  const status = statusOf(error)
  if (status === 404) return true
  return nameOf(error) === 'NotFoundError'
}

function isAuthStatus(error: unknown): boolean {
  const status = statusOf(error)
  if (status === 401 || status === 403) return true
  return nameOf(error) === 'AuthError'
}

/**
 * Transport/protocol refusals that stamp `retryable: false` (EnvelopeError,
 * OpenError). Auth 401/403 are handled separately — they get one short RQ retry
 * even though classifyError marks them not manually-retryable.
 */
function isPermanentTransportRefusal(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('retryable' in error)) return false
  if ((error as { retryable?: boolean }).retryable !== false) return false
  return !isAuthStatus(error)
}

/** Transient failures worth an automatic retry before escalating to the user. */
export function isTransientError(error: unknown): boolean {
  const status = statusOf(error)
  if (status !== undefined) return TRANSIENT_STATUSES.has(status)
  return codeOf(error) === 'TIMEOUT'
}

/**
 * TanStack Query `retry` predicate. `failureCount` is 0 when deciding the first
 * retry after the initial failure.
 *
 * Retries everything except 404 and permanent transport refusals; 401/403 get
 * exactly one short retry; other failures get two (2s then 1s).
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (isNotFoundError(error)) return false
  if (isPermanentTransportRefusal(error)) return false
  if (isAuthStatus(error)) return failureCount < AUTH_RETRY_COUNT
  return failureCount < QUERY_RETRY_COUNT
}

/** TanStack Query `retryDelay` — pairs with `shouldRetryQuery`. */
export function queryRetryDelay(failureCount: number, error: unknown): number {
  if (isAuthStatus(error)) return AUTH_RETRY_DELAY_MS
  return QUERY_RETRY_DELAYS_MS[Math.min(failureCount, QUERY_RETRY_DELAYS_MS.length - 1)] ?? QUERY_RETRY_DELAYS_MS[0]
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('aborted'))
      return
    }
    const timer = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason ?? new Error('aborted'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Same schedule as RQ defaults, for Hub fetches that catch per-server errors
 * inside the queryFn (so TanStack never sees a thrown failure to retry).
 * Marks the recovery store for the whole silent-retry window (loader / pill).
 */
export async function withSilentRetries<T>(
  fn: () => Promise<T>,
  options?: {
    signal?: AbortSignal
  },
): Promise<T> {
  let failureCount = 0
  let recoveryHeld = false
  try {
    for (;;) {
      try {
        return await fn()
      } catch (error) {
        if (options?.signal?.aborted) throw error
        if (!shouldRetryQuery(failureCount, error)) throw error
        if (!recoveryHeld) {
          useQueryRecoveryStore.getState().beginNestedRetry()
          recoveryHeld = true
        }
        await sleep(queryRetryDelay(failureCount, error), options?.signal)
        failureCount++
      }
    }
  } finally {
    if (recoveryHeld) useQueryRecoveryStore.getState().endNestedRetry()
  }
}

/**
 * Maps a raw fetch/API error to a presentation classification. Deliberately
 * does not decide title/message wording for query-category failures — those
 * stay the existing per-category copy in the Status sheet, which already carries
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
