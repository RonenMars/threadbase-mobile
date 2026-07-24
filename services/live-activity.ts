import type { Session } from '@/types/api'
import {
  LAST_OUTPUT_MAX_CHARS,
  MAX_LIVE_ACTIVITIES,
  type LiveSessionState,
} from '@/types/live-activity'
import { stripAnsi } from '@/utils/stripAnsi'
import { stripBoxDrawing } from '@/utils/stripBoxDrawing'

/** Compound identity — a session id alone is not unique across servers. */
export function liveActivityKey(serverId: string, sessionId: string): string {
  return `${serverId}::${sessionId}`
}

/**
 * A session is over when any of three signals fire. Managed servers set
 * `completedAt`; external ones report `processLiveness`; older servers do
 * neither, leaving the legacy idle-without-a-PTY heuristic as the only tell.
 */
export function isTerminal(session: Session): boolean {
  return (
    session.processLiveness === 'gone' ||
    !!session.completedAt ||
    (session.status === 'idle' && !session.ptyAttached)
  )
}

function truncateOutput(raw: string): string {
  const clean = stripBoxDrawing(stripAnsi(raw))
  if (clean.length <= LAST_OUTPUT_MAX_CHARS) return clean
  const clipped = clean.slice(0, LAST_OUTPUT_MAX_CHARS)
  const lastSpace = clipped.lastIndexOf(' ')
  // Only honor a word boundary that keeps most of the budget — otherwise a
  // single long token would collapse the line to a few characters.
  const cut = lastSpace > LAST_OUTPUT_MAX_CHARS / 2 ? clipped.slice(0, lastSpace) : clipped
  return `${cut.trimEnd()}…`
}

/** Maps a session onto a live surface, or `null` when it should not have one. */
export function toLiveState(session: Session, serverId: string): LiveSessionState | null {
  if (isTerminal(session)) return null
  if (session.status !== 'running' && session.status !== 'waiting_input') return null
  const startedAt = Date.parse(session.startedAt)
  if (Number.isNaN(startedAt)) return null
  return {
    sessionId: session.id,
    serverId,
    projectName: session.projectName,
    status: session.status,
    startedAt,
    lastOutput: truncateOutput(session.lastOutput ?? ''),
  }
}

export type LiveActivityAction =
  | { type: 'start'; key: string; state: LiveSessionState }
  | { type: 'update'; key: string; state: LiveSessionState }
  | { type: 'end'; key: string }

/** What the reconciler already has on screen. `lastUpdatedAt` only has to order. */
export interface TrackedActivity {
  key: string
  lastUpdatedAt: number
}

/**
 * Decides what to do about one incoming session, given everything currently on
 * screen. Pure so the whole cap/eviction policy is testable without a device.
 */
export function decideActions(
  tracked: readonly TrackedActivity[],
  incoming: LiveSessionState | null,
  key: string,
): LiveActivityAction[] {
  if (!incoming) {
    return tracked.some((t) => t.key === key) ? [{ type: 'end', key }] : []
  }
  if (tracked.some((t) => t.key === key)) {
    return [{ type: 'update', key, state: incoming }]
  }
  if (tracked.length < MAX_LIVE_ACTIVITIES) {
    return [{ type: 'start', key, state: incoming }]
  }
  // Evict by staleness of the last update, not by start time: an old session
  // still emitting output is more worth a slot than a newer silent one.
  const victim = tracked.reduce((oldest, t) =>
    t.lastUpdatedAt < oldest.lastUpdatedAt ? t : oldest,
  )
  return [
    { type: 'end', key: victim.key },
    { type: 'start', key, state: incoming },
  ]
}
