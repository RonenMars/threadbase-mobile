import { NotFoundError } from '@/services/api-client'
import { classifyError, isTransientError } from '@/services/error-policy'
import i18n from '@/test-utils/i18n-setup'

const t = i18n.getFixedT('en', 'common')

describe('classifyError', () => {
  it('classifies a 401 as blocking and not retryable', () => {
    const result = classifyError({ status: 401 }, t)
    expect(result.presentation).toBe('blocking')
    expect(result.retryable).toBe(false)
    expect(result.description).toBeTruthy()
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
