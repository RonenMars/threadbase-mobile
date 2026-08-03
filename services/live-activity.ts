import type { LiveActivity } from 'expo-widgets'

import SessionLiveActivity from '@/widgets/SessionLiveActivity'
import { sessionPhase } from '@/lib/sessionPresentation'
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
    sessionPhase(session) === 'ended' ||
    // A live activity only ever exists for a session that already went live,
    // so unlike a cold landing this can't be a not-yet-started session —
    // idle+detached here means it ended on a server too old to set completedAt.
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
  | { type: 'end'; key: string; finalState?: LiveSessionState }

/**
 * What the reconciler already has on screen. `lastUpdatedAt` only has to
 * order; `turnOpen` mirrors the streamer's per-activity tracking so a turn
 * boundary can be detected from one session snapshot to the next.
 */
export interface TrackedActivity {
  key: string
  lastUpdatedAt: number
  turnOpen: boolean
}

/**
 * Decides what to do about one incoming session, given everything currently on
 * screen and the previous status for the same key. Pure so the whole
 * open/close/cap policy is testable without a device.
 *
 * Per-turn, matching the streamer's push design (docs/guides/live-activity-push.md
 * in tb-streamer): a turn opens on `waiting_input → running` — the user sent a
 * prompt — and closes on the matching `running → waiting_input`, rendering one
 * last "Finished" frame via `end`'s `finalState` rather than staying live. A
 * session's very first `running`, with no prior `waiting_input`, opens
 * nothing — that's what keeps a freshly booted or idling session from showing
 * a surface before the user has asked for anything. Any other terminal signal
 * on an open turn also ends it with a "Finished" frame — the push design does
 * not distinguish a clean turn-close from a session dying mid-turn either.
 */
export function decideActions(
  tracked: readonly TrackedActivity[],
  previousStatus: 'running' | 'waiting_input' | undefined,
  incoming: LiveSessionState | null,
  key: string,
): LiveActivityAction[] {
  const entry = tracked.find((t) => t.key === key)

  if (!incoming) {
    // Not renderable: the session is no longer live. Close an open turn with
    // its last frame; otherwise there is nothing to close.
    return entry?.turnOpen ? [{ type: 'end', key }] : []
  }

  if (incoming.status === 'running' && previousStatus === 'waiting_input') {
    if (entry) return [{ type: 'update', key, state: incoming }]
    if (tracked.length < MAX_LIVE_ACTIVITIES) return [{ type: 'start', key, state: incoming }]
    // Evict by staleness of the last update, not by start time: an old session
    // still emitting output is more worth a slot than a newer silent one.
    const victim = tracked.reduce((oldest, t) => (t.lastUpdatedAt < oldest.lastUpdatedAt ? t : oldest))
    return [
      { type: 'end', key: victim.key },
      { type: 'start', key, state: incoming },
    ]
  }

  if (incoming.status === 'waiting_input' && previousStatus === 'running') {
    // Only a real turn end if one was actually opened — the session's very
    // first waiting_input (boot ready, no prior turn) has none.
    return entry?.turnOpen ? [{ type: 'end', key, finalState: incoming }] : []
  }

  // Any other same-status re-emit on an open turn refreshes lastOutput; a
  // session with no open turn (first running, first waiting_input) is not
  // tracked and gets nothing.
  return entry?.turnOpen ? [{ type: 'update', key, state: incoming }] : []
}

interface LiveHandle extends TrackedActivity {
  activity: LiveActivity<LiveSessionState>
}

const handles = new Map<string, LiveHandle>()

/**
 * Last `running`/`waiting_input` seen per key, kept independent of `handles`:
 * a session can sit at `waiting_input` with no open turn (no handle) for a
 * while before the user sends a prompt, and that prior status is still what
 * turns the next `running` into a turn-open edge.
 */
const lastStatus = new Map<string, 'running' | 'waiting_input'>()

// A monotonic counter, not a clock: several updates routinely land inside the
// same millisecond, and `Date.now()` ties would make LRU eviction pick an
// arbitrary victim. Only the ordering matters.
let touchCounter = 0

function tracked(): TrackedActivity[] {
  return [...handles.values()].map(({ key, lastUpdatedAt, turnOpen }) => ({
    key,
    lastUpdatedAt,
    turnOpen,
  }))
}

function deepLink(state: LiveSessionState): string {
  return `threadbase://session/${state.sessionId}?server=${state.serverId}`
}

async function apply(action: LiveActivityAction): Promise<void> {
  if (action.type === 'end') {
    const handle = handles.get(action.key)
    if (!handle) return
    handles.delete(action.key)
    if (action.finalState) {
      // 'default' so the "Finished" frame stays visible for the OS's normal
      // post-end grace period instead of vanishing the instant it appears.
      await handle.activity.end('default', action.finalState)
      return
    }
    // 'immediate' — an evicted or otherwise turn-less end has no frame to show.
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
    handles.set(action.key, {
      key: action.key,
      lastUpdatedAt: ++touchCounter,
      turnOpen: true,
      activity,
    })
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
  const incoming = toLiveState(session, serverId)
  const previousStatus = lastStatus.get(key)
  for (const action of decideActions(tracked(), previousStatus, incoming, key)) {
    await apply(action)
  }
  if (session.status === 'running' || session.status === 'waiting_input') {
    lastStatus.set(key, session.status)
  } else {
    lastStatus.delete(key)
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
  lastStatus.clear()
}

/** Test seam — the module-level maps would otherwise leak between cases. */
export function resetLiveActivities(): void {
  handles.clear()
  lastStatus.clear()
}
