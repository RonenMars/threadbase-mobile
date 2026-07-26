import type { LiveActivity } from 'expo-widgets'

import SessionLiveActivity from '@/widgets/SessionLiveActivity'
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

interface LiveHandle extends TrackedActivity {
  activity: LiveActivity<LiveSessionState>
}

const handles = new Map<string, LiveHandle>()

// A monotonic counter, not a clock: several updates routinely land inside the
// same millisecond, and `Date.now()` ties would make LRU eviction pick an
// arbitrary victim. Only the ordering matters.
let touchCounter = 0

function tracked(): TrackedActivity[] {
  return [...handles.values()].map(({ key, lastUpdatedAt }) => ({ key, lastUpdatedAt }))
}

function deepLink(state: LiveSessionState): string {
  return `threadbase://session/${state.sessionId}?server=${state.serverId}`
}

async function apply(action: LiveActivityAction): Promise<void> {
  if (action.type === 'end') {
    const handle = handles.get(action.key)
    if (!handle) return
    handles.delete(action.key)
    // 'immediate' so a finished session's surface does not linger on the Lock Screen.
    await handle.activity.end('immediate')
    return
  }
  if (action.type === 'start') {
    // KNOWN LIMITATION — a surface started here disappears silently at Apple's
    // ~8h ceiling, while the session may well still be running. To the user that
    // reads as "the session ended". It is not a bug in this file.
    //
    // The intended mitigation was `staleDate`, which greys the surface out
    // instead of dropping it. expo-widgets hardcodes `staleDate: nil`
    // (ios/LiveActivity.swift:23,35 and ios/LiveActivityFactory.swift:30) and
    // exposes no JS parameter, so it cannot be set from here at all.
    //
    // Do not patch expo-widgets or work around this. Phase 1b's streamer-side
    // APNs renewal removes the 8h ceiling outright and makes the whole question
    // moot; until it lands, silent expiry is the accepted behavior.
    const activity = SessionLiveActivity.start(action.state, deepLink(action.state))
    handles.set(action.key, { key: action.key, lastUpdatedAt: ++touchCounter, activity })
    return
  }
  const handle = handles.get(action.key)
  if (!handle) return
  handle.lastUpdatedAt = ++touchCounter
  await handle.activity.update(action.state)
}

/**
 * Drives the live surfaces from one `session_update`. Safe to call for every
 * frame — `decideActions` collapses the no-op cases to an empty list.
 */
export async function reconcile(serverId: string, session: Session): Promise<void> {
  const key = liveActivityKey(serverId, session.id)
  for (const action of decideActions(tracked(), toLiveState(session, serverId), key)) {
    await apply(action)
  }
}

/**
 * Adopts activities that outlived the JS context (app restarted mid-session).
 * Without this they would be untracked and could never be updated or ended.
 */
export function adoptRunningActivities(): void {
  for (const activity of SessionLiveActivity.getInstances()) {
    // The native instance carries no props back, so there is no key to recover
    // and no way to match it to a session. Ending is the honest option: a
    // surface we cannot update would freeze on stale data indefinitely.
    void activity.end('immediate')
  }
  handles.clear()
}

/** Test seam — the module-level map would otherwise leak between cases. */
export function resetLiveActivities(): void {
  handles.clear()
}
