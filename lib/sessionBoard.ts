import type { MultiSession } from '@/types/api'

// A server may send a timestamp this build cannot parse; NaN degrades to 0.
export function sessionLastActivityMs(s: MultiSession): number {
  const ms = s.completedAt ? Date.parse(s.completedAt) : Date.parse(s.startedAt) + (s.elapsedMs ?? 0)
  return Number.isFinite(ms) ? ms : 0
}
