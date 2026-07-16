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

import { clientLog } from '@/lib/clientLog'

const TTL_MS = 10_000

const recent = new Map<string, number>()

export function markNavigatedToSession(sessionId: string): void {
  const now = Date.now()
  recent.set(sessionId, now)
  clientLog.info('sessionNavGuard', 'markNavigatedToSession', {
    sessionId,
    now,
    ttlMs: TTL_MS,
    mapSize: recent.size,
  })
}

export function shouldSkipAutoNav(sessionId: string): boolean {
  const t = recent.get(sessionId)
  if (t === undefined) {
    clientLog.info('sessionNavGuard', 'shouldSkipAutoNav → false (not marked)', { sessionId })
    return false
  }
  const ageMs = Date.now() - t
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
