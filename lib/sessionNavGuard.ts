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
// Browse start race: session_ready can beat the /api/sessions/start HTTP
// response, so we don't know the session id yet when ready fires. While a
// browse-initiated start is in flight, suppress ALL global auto-nav; the
// browse modal owns navigation via dismiss → next-frame push.

import { clientLog } from '@/lib/clientLog'

const TTL_MS = 10_000
/** Covers START_SESSION_TIMEOUT_MS (15s) with a little margin. */
const BROWSE_START_SUPPRESS_MS = 20_000

const recent = new Map<string, number>()
let browseStartSuppressUntil = 0

export function suppressAutoNavForBrowseStart(ttlMs = BROWSE_START_SUPPRESS_MS): void {
  browseStartSuppressUntil = Date.now() + ttlMs
  clientLog.info('startSession', 'suppressAutoNavForBrowseStart', {
    until: browseStartSuppressUntil,
    ttlMs,
  })
  clientLog.info('sessionNavGuard', 'suppressAutoNavForBrowseStart', {
    until: browseStartSuppressUntil,
    ttlMs,
  })
}

export function clearBrowseStartAutoNavSuppress(): void {
  if (browseStartSuppressUntil === 0) return
  browseStartSuppressUntil = 0
  clientLog.info('sessionNavGuard', 'clearBrowseStartAutoNavSuppress')
}

export function markNavigatedToSession(sessionId: string): void {
  const now = Date.now()
  recent.set(sessionId, now)
  // Id-specific mark takes over; drop the blanket browse-start suppress.
  browseStartSuppressUntil = 0
  clientLog.info('sessionNavGuard', 'markNavigatedToSession', {
    sessionId,
    now,
    ttlMs: TTL_MS,
    mapSize: recent.size,
  })
}

export function shouldSkipAutoNav(sessionId: string): boolean {
  const now = Date.now()
  if (now < browseStartSuppressUntil) {
    clientLog.info('startSession', 'shouldSkipAutoNav → true (browse start pending)', {
      sessionId,
      remainingMs: browseStartSuppressUntil - now,
    })
    clientLog.info('sessionNavGuard', 'shouldSkipAutoNav → true (browse start pending)', {
      sessionId,
      remainingMs: browseStartSuppressUntil - now,
    })
    return true
  }
  if (browseStartSuppressUntil !== 0) {
    browseStartSuppressUntil = 0
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
