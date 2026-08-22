import {
  shouldRedirectPairedUserHome,
  shouldRedirectToOnboarding,
} from '@/app/_layout'

/**
 * Regression guard for the cold-start race on `threadbase://pair`.
 *
 * AuthGate redirects to /onboarding whenever no servers are paired and the
 * current route is not onboarding. A pair deep link opened on a fresh install
 * hits exactly that state — zero servers — while its token exchange is still in
 * flight. Without the `pair` exemption the redirect wins the race: on success
 * the user sees an onboarding flash, and on failure the error screen unmounts
 * before it renders, so an expired link is indistinguishable from the app
 * ignoring the tap. That is the silent first-run failure the pair route exists
 * to fix, so it must not be reintroduced one layer up.
 */
describe('shouldRedirectToOnboarding', () => {
  it('does not bounce a cold-start pair deep link to onboarding', () => {
    expect(shouldRedirectToOnboarding('pair', false)).toBe(false)
  })

  it('still bounces any other route with no paired servers', () => {
    expect(shouldRedirectToOnboarding('index', false)).toBe(true)
    expect(shouldRedirectToOnboarding('session', false)).toBe(true)
    expect(shouldRedirectToOnboarding('settings', false)).toBe(true)
    expect(shouldRedirectToOnboarding(undefined, false)).toBe(true)
  })

  it('leaves onboarding itself alone, so the redirect cannot loop', () => {
    expect(shouldRedirectToOnboarding('onboarding', false)).toBe(false)
  })

  it('never redirects once a server is paired', () => {
    expect(shouldRedirectToOnboarding('pair', true)).toBe(false)
    expect(shouldRedirectToOnboarding('index', true)).toBe(false)
    expect(shouldRedirectToOnboarding('onboarding', true)).toBe(false)
  })
})

describe('shouldRedirectPairedUserHome', () => {
  it('keeps paired users in explicit onboarding review mode', () => {
    expect(shouldRedirectPairedUserHome('onboarding', true, 'review')).toBe(false)
  })

  it('preserves the existing add-server exemption and redirects ordinary onboarding', () => {
    expect(shouldRedirectPairedUserHome('onboarding', true, 'add')).toBe(false)
    expect(shouldRedirectPairedUserHome('onboarding', true, undefined)).toBe(true)
    expect(shouldRedirectPairedUserHome('onboarding', false, undefined)).toBe(false)
    expect(shouldRedirectPairedUserHome('settings', true, undefined)).toBe(false)
  })
})
