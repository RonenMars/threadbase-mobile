import type { Session } from '@/types/api'
import { isPresentationLive } from '@/lib/sessionPresentation'

function parseMs(iso: string | null | undefined): number {
  if (!iso) return NaN
  return Date.parse(iso)
}

/**
 * When a session was last active, in epoch ms (0 when unparseable).
 *
 * `startedAt + elapsedMs` is only a last-activity time while a turn is
 * running: the server counts `elapsedMs` up to the request time for any
 * session without `completedAt`. A session recovered after a hard stop
 * (Windows service restarts never stamp `completedAt`), or a live one that is
 * waiting or an external one sitting idle, would otherwise read as active
 * "now" on every fetch, so only a running session counts `elapsedMs`.
 *
 * An externally owned session carries `activity.lastEventAt`, the time of its
 * last transcript write, which is the real answer and wins over `elapsedMs`.
 * An external session has no PTY and no turn clock, so `elapsedMs` never
 * counts for it: with no activity data it reads as its start time, not "now".
 */
export function sessionActivityMs(session: Session): number {
  let ms = parseMs(session.completedAt)
  if (!Number.isFinite(ms)) {
    const startMs = parseMs(session.startedAt)
    const lastMs = parseMs(session.lastActivityAt)
    const eventMs = parseMs(session.activity?.lastEventAt)
    if (Number.isFinite(eventMs)) {
      ms = eventMs
    } else if (session.ownership !== 'external' && isPresentationLive(session) && (session.status === 'running' || !Number.isFinite(lastMs))) {
      ms = startMs + (session.elapsedMs ?? 0)
    } else {
      ms = Number.isFinite(lastMs) ? lastMs : startMs
    }
  }
  return Number.isFinite(ms) ? ms : 0
}
