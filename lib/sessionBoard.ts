import type { MultiSession } from '@/types/api'

// startedAt + elapsedMs is not activity: elapsedMs keeps growing on an idle,
// resumable session, which would date it "now". A server may send a timestamp
// this build cannot parse; NaN degrades to 0.
export function sessionLastActivityMs(s: MultiSession): number {
  const ms = Date.parse(s.lastActivityAt ?? s.completedAt ?? s.startedAt)
  return Number.isFinite(ms) ? ms : 0
}
