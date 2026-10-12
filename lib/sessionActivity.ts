import type { Session } from '@/types/api'
import { isPresentationLive } from '@/lib/sessionPresentation'

function parseMs(iso: string | null | undefined): number {
  if (!iso) return NaN
  return Date.parse(iso)
}

/**
 * When a session was last active, in epoch ms (0 when unparseable).
 *
 * `startedAt + elapsedMs` is only a last-activity time while something is
 * running: the server counts `elapsedMs` up to the request time for any
 * session without `completedAt`. A session recovered after a hard stop
 * (Windows service restarts never stamp `completedAt`) would otherwise read as
 * active "now" on every fetch, so a non-live session uses `lastActivityAt`.
 */
export function sessionActivityMs(session: Session): number {
  let ms = parseMs(session.completedAt)
  if (!Number.isFinite(ms)) {
    const startMs = parseMs(session.startedAt)
    if (isPresentationLive(session)) {
      ms = startMs + (session.elapsedMs ?? 0)
    } else {
      const lastMs = parseMs(session.lastActivityAt)
      ms = Number.isFinite(lastMs) ? lastMs : startMs
    }
  }
  return Number.isFinite(ms) ? ms : 0
}
