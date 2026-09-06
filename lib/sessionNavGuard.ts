// Suppress duplicate auto-navigation to a session that the user just
// manually navigated to. The global `session_ready` listener in app/_layout
// pushes /session/<id> whenever a streamer reports a PTY is ready — useful
// when a session becomes ready while the user is on a different screen,
// harmful when the user just tapped Resume Session and is already there.
//
// Flow:
//   - Explicit caller (e.g. Resume Session) calls markNavigatedToSession(id)
//     immediately before router.push.
//   - Global listener calls shouldSkipAutoNav(id) and bails out if true.
//   - Entries auto-expire after TTL_MS so a later, legitimate session_ready
//     for the same id (e.g. after a streamer reconnect) is not suppressed.
//
// Pending-start race: session_ready can beat the HTTP response that names the
// session (start, resume, fork), so we don't know the id yet when ready fires.
// While such a start is in flight, suppress ALL global auto-nav; the caller
// owns navigation once its response lands.

import { clientLog } from '@/lib/clientLog'

const TTL_MS = 10_000
/** Covers START_SESSION_TIMEOUT_MS (15s) with a little margin. */
const PENDING_START_SUPPRESS_MS = 20_000

const recent = new Map<string, number>()
let pendingStartSuppressUntil = 0

export function suppressAutoNavForPendingStart(ttlMs = PENDING_START_SUPPRESS_MS): void {
  pendingStartSuppressUntil = Date.now() + ttlMs
  clientLog.info('sessionNavGuard', 'suppressAutoNavForPendingStart', {
    until: pendingStartSuppressUntil,
    ttlMs,
  })
}

export function clearAutoNavSuppress(): void {
  if (pendingStartSuppressUntil === 0) return
  pendingStartSuppressUntil = 0
  clientLog.info('sessionNavGuard', 'clearAutoNavSuppress')
}

export function markNavigatedToSession(sessionId: string): void {
  const now = Date.now()
  recent.set(sessionId, now)
  // Id-specific mark takes over; drop the blanket pending-start suppress.
  pendingStartSuppressUntil = 0
  clientLog.info('sessionNavGuard', 'markNavigatedToSession', {
    sessionId,
    now,
    ttlMs: TTL_MS,
    mapSize: recent.size,
  })
}

export function shouldSkipAutoNav(sessionId: string): boolean {
  const now = Date.now()
  if (now < pendingStartSuppressUntil) {
    clientLog.info('sessionNavGuard', 'shouldSkipAutoNav → true (pending start)', {
      sessionId,
      remainingMs: pendingStartSuppressUntil - now,
    })
    return true
  }
  if (pendingStartSuppressUntil !== 0) {
    pendingStartSuppressUntil = 0
  }

  const t = recent.get(sessionId)
  if (t === undefined) {
    clientLog.info('sessionNavGuard', 'shouldSkipAutoNav → false (not marked)', { sessionId })
    return false
  }
  const ageMs = now - t
  if (ageMs > TTL_MS) {
    recent.delete(sessionId)
    clientLog.info('sessionNavGuard', 'shouldSkipAutoNav → false (TTL expired)', {
      sessionId,
      ageMs,
      ttlMs: TTL_MS,
    })
    return false
  }
  clientLog.info('sessionNavGuard', 'shouldSkipAutoNav → true (within TTL)', {
    sessionId,
    ageMs,
    ttlMs: TTL_MS,
  })
  return true
}
