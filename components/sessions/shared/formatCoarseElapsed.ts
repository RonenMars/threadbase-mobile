/** "45s", "2m", "1h 5m" — a live qualifier, never a clock stamp and never a raw hour count. */
export function formatCoarseElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

/**
 * How long `waiting_input` has lasted. Prefer `statusUpdatedAt` (the status
 * flip). Older streamers omit it, so fall back to the JSONL tail stamp — that
 * is last activity, not wait start. Never `elapsedMs`.
 */
export function waitSinceIso(session: {
  statusUpdatedAt?: string
  activity?: { lastEventAt: string } | null
}): string | undefined {
  return session.statusUpdatedAt ?? session.activity?.lastEventAt
}

export function formatWaitSince(iso: string | undefined | null, now: number = Date.now()): string | null {
  if (!iso) return null
  const start = Date.parse(iso)
  if (!Number.isFinite(start)) return null
  return formatCoarseElapsed(Math.max(0, now - start))
}
