/**
 * Frequency policy for the post-feedback Anonymous Diagnostics suggestion
 * (spec §14): at most 2 impressions in any rolling 30-day period, tracked by
 * persisted impression timestamps rather than a calendar-month counter.
 */

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000
const MAX_IMPRESSIONS_PER_WINDOW = 2

/** Whether the suggestion may be shown again right now. */
export function isPostFeedbackDiagnosticsSuggestionEligible(
  impressions: number[],
  now: number = Date.now(),
): boolean {
  const withinWindow = impressions.filter((ts) => now - ts < WINDOW_MS)
  return withinWindow.length < MAX_IMPRESSIONS_PER_WINDOW
}
