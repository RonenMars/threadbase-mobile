export function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

export type EarlierBucket = 'last7Days' | 'last14Days' | 'lastMonth' | 'earlier'

const DAY_MS = 86_400_000

/** Rolling-window bucket for the Now list's "earlier" accordion — off the
 * entry's own timestamp, not calendar-day boundaries like isToday. */
export function earlierBucketFor(ms: number, now: number): EarlierBucket {
  const diff = now - ms
  if (diff < 7 * DAY_MS) return 'last7Days'
  if (diff < 14 * DAY_MS) return 'last14Days'
  if (diff < 30 * DAY_MS) return 'lastMonth'
  return 'earlier'
}

/** Duration formatter used by session rows for "running for 4m 12s" elapsed
 * counters. Distinct from list-row timestamps (see formatListTime). */
export function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}
