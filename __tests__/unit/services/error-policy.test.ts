import { AuthError, NetworkError, NotFoundError } from '@/services/api-client'
import { EnvelopeError } from '@/services/authed-fetch'
import {
  AUTH_RETRY_DELAY_MS,
  classifyError,
  isTransientError,
  queryRetryDelay,
  shouldRetryQuery,
  withSilentRetries,
} from '@/services/error-policy'
import i18n from '@/test-utils/i18n-setup'

const t = i18n.getFixedT('en', 'common')

describe('classifyError', () => {
  it('classifies a 401 as blocking and not retryable', () => {
    const result = classifyError({ status: 401 }, t)
    expect(result.presentation).toBe('blocking')
    expect(result.retryable).toBe(false)
    expect(result.description).toBeTruthy()
  })

  it('classifies a real AuthError as blocking via its stamped status', () => {
    const result = classifyError(new AuthError('shared', '/api/sessions'), t)
    expect(result.presentation).toBe('blocking')
    expect(result.retryable).toBe(false)
    expect(result.code).toBe('HTTP_401')
    expect(result.description).toBe(t('errorPolicy.sessionExpired'))
  })

  it('classifies a 403 as blocking and not retryable', () => {
    const result = classifyError({ status: 403 }, t)
    expect(result.presentation).toBe('blocking')
    expect(result.retryable).toBe(false)
  })

  it('classifies a 404 as recovery-sheet and not retryable', () => {
    const result = classifyError({ status: 404 }, t)
    expect(result.presentation).toBe('recovery-sheet')
    expect(result.retryable).toBe(false)
    expect(result.code).toBe('HTTP_404')
  })

  it('classifies a real NotFoundError as a 404, not as the generic default', () => {
    // NotFoundError used to carry no status and no code, so it fell past every
    // branch below to the catch-all — which reports retryable:true. The banner
    // then told the user "Retry usually fixes it" about a thing that is gone.
    const result = classifyError(new NotFoundError('/api/conversations/abc?msg_limit=80'), t)
    expect(result.code).toBe('HTTP_404')
    expect(result.retryable).toBe(false)
    expect(result.description).toBe(t('errorPolicy.notFound'))
  })

  it('classifies a 429 as recovery-sheet and retryable', () => {
    const result = classifyError({ status: 429 }, t)
    expect(result.presentation).toBe('recovery-sheet')
    expect(result.retryable).toBe(true)
  })

  it('classifies a 503 as recovery-sheet and retryable', () => {
    const result = classifyError({ status: 503 }, t)
    expect(result.presentation).toBe('recovery-sheet')
    expect(result.retryable).toBe(true)
    expect(result.code).toBe('HTTP_503')
  })

  it('classifies a TIMEOUT code as retryable', () => {
    const result = classifyError({ code: 'TIMEOUT' }, t)
    expect(result.retryable).toBe(true)
    expect(result.description).toBeTruthy()
  })

  it('falls back to no description for an error with neither status nor code', () => {
    const result = classifyError(new Error('boom'), t)
    expect(result.description).toBeUndefined()
    expect(result.retryable).toBe(true)
  })

  it('treats a bare 400 as retryable with no special description (deterministic, but unclassified)', () => {
    const result = classifyError({ status: 400 }, t)
    expect(result.code).toBe('HTTP_400')
  })
})

describe('isTransientError', () => {
  it.each([429, 502, 503, 504])('treats status %d as transient', (status) => {
    expect(isTransientError({ status })).toBe(true)
  })

  it.each([400, 401, 403, 404, 422])('does not treat status %d as transient', (status) => {
    expect(isTransientError({ status })).toBe(false)
  })

  it('treats a TIMEOUT code with no status as transient', () => {
    expect(isTransientError({ code: 'TIMEOUT' })).toBe(true)
  })

  it('does not treat an unknown code with no status as transient', () => {
    expect(isTransientError({ code: 'SOMETHING_ELSE' })).toBe(false)
  })
})

describe('shouldRetryQuery', () => {
  it('never retries a 404', () => {
    expect(shouldRetryQuery(0, { status: 404 })).toBe(false)
    expect(shouldRetryQuery(0, new NotFoundError('/api/x'))).toBe(false)
  })

  it('gives 401/403 exactly one retry', () => {
    expect(shouldRetryQuery(0, new AuthError('shared', '/api/sessions'))).toBe(true)
    expect(shouldRetryQuery(1, new AuthError('shared', '/api/sessions'))).toBe(false)
    expect(shouldRetryQuery(0, { status: 403 })).toBe(true)
    expect(shouldRetryQuery(1, { status: 403 })).toBe(false)
  })

  it('does not retry a permanent EnvelopeError', () => {
    const err = new EnvelopeError('E2EE_DEVICE_REVOKED', 'revoked', '/api/x', false)
    expect(shouldRetryQuery(0, err)).toBe(false)
  })

  it('retries a retryable EnvelopeError twice', () => {
    const err = new EnvelopeError('E2EE_TRANSIENT', 'busy', '/api/x', true)
    expect(shouldRetryQuery(0, err)).toBe(true)
    expect(shouldRetryQuery(1, err)).toBe(true)
    expect(shouldRetryQuery(2, err)).toBe(false)
  })

  it('retries ordinary network failures twice', () => {
    const err = new NetworkError('Failed to reach server')
    expect(shouldRetryQuery(0, err)).toBe(true)
    expect(shouldRetryQuery(1, err)).toBe(true)
    expect(shouldRetryQuery(2, err)).toBe(false)
  })
})

describe('queryRetryDelay', () => {
  it('uses 1.5s for auth failures', () => {
    expect(queryRetryDelay(0, { status: 401 })).toBe(AUTH_RETRY_DELAY_MS)
  })

  it('uses 2s then 1s for ordinary failures', () => {
    expect(queryRetryDelay(0, new NetworkError('boom'))).toBe(2000)
    expect(queryRetryDelay(1, new NetworkError('boom'))).toBe(1000)
  })
})

describe('withSilentRetries', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns on first success without delaying', async () => {
    const fn = jest.fn().mockResolvedValue('ok')
    await expect(withSilentRetries(fn)).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries then succeeds after the first delay', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new NetworkError('boom'))
      .mockResolvedValueOnce('ok')
    const pending = withSilentRetries(fn)
    await jest.advanceTimersByTimeAsync(2000)
    await expect(pending).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
