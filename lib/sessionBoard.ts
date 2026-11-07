import type { MultiSession } from '@/types/api'

// Older servers omit lastActivityAt; startedAt + elapsedMs is their only clock,
// though it overstates an idle resumable session. A server may send a timestamp
// this build cannot parse; NaN degrades to 0.
export function sessionLastActivityMs(s: MultiSession): number {
  let ms: number
  if (s.lastActivityAt) ms = Date.parse(s.lastActivityAt)
  else if (s.completedAt) ms = Date.parse(s.completedAt)
  else ms = Date.parse(s.startedAt) + (s.elapsedMs ?? 0)
  return Number.isFinite(ms) ? ms : 0
}
