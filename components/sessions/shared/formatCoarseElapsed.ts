/** "45s", "2m", "1h 5m" — a live qualifier, never a clock stamp and never a raw hour count. */
export function formatCoarseElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

/** Elapsed since `statusUpdatedAt`; while the status is `waiting_input` that is when the wait began. */
export function formatWaitingSince(iso: string): string {
  return formatCoarseElapsed(Date.now() - Date.parse(iso))
}
