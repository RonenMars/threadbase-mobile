import { isPostFeedbackDiagnosticsSuggestionEligible } from '@/lib/postFeedbackDiagnosticsSuggestion'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_700_000_000_000

describe('isPostFeedbackDiagnosticsSuggestionEligible (spec §14)', () => {
  it('is eligible with no prior impressions', () => {
    expect(isPostFeedbackDiagnosticsSuggestionEligible([], NOW)).toBe(true)
  })

  it('is eligible with one impression inside the window', () => {
    expect(isPostFeedbackDiagnosticsSuggestionEligible([NOW - DAY], NOW)).toBe(true)
  })

  it('is NOT eligible with two impressions inside the window', () => {
    expect(isPostFeedbackDiagnosticsSuggestionEligible([NOW - 20 * DAY, NOW - DAY], NOW)).toBe(false)
  })

  it('ignores impressions outside the rolling 30-day window', () => {
    expect(isPostFeedbackDiagnosticsSuggestionEligible([NOW - 31 * DAY, NOW - 40 * DAY], NOW)).toBe(true)
  })

  it('uses a rolling window, not a calendar month — becomes eligible again once old impressions age out', () => {
    const impressions = [NOW - 29 * DAY, NOW - 15 * DAY]
    expect(isPostFeedbackDiagnosticsSuggestionEligible(impressions, NOW)).toBe(false)
    const later = NOW + 2 * DAY // the 29-day-old impression is now 31 days old
    expect(isPostFeedbackDiagnosticsSuggestionEligible(impressions, later)).toBe(true)
  })
})
