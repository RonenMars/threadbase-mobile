/**
 * Bounded, in-memory ring buffer of sanitized app-lifecycle events for
 * diagnostics.
 *
 * PRIVACY: events are a STRICT ENUM only — no free-form messages, no ids, no
 * payloads. Each entry is `{ event, at }` where `event` is one of
 * `DiagnosticEvent` and `at` is a coarse (minute-truncated) ISO timestamp. This
 * makes it impossible to store a URL, session title, or prompt here by
 * construction. The buffer is memory-only (never persisted) and capped.
 */

/** The complete, closed set of events we will ever record. */
export const DIAGNOSTIC_EVENTS = [
  'app_started',
  'app_resumed',
  'connection_started',
  'connection_succeeded',
  'connection_failed',
  'websocket_disconnected',
  'notification_permission_changed',
  'server_added',
  'server_removed',
  'feedback_opened',
  'feedback_submitted',
] as const

export type DiagnosticEvent = (typeof DIAGNOSTIC_EVENTS)[number]

const EVENT_SET: ReadonlySet<string> = new Set(DIAGNOSTIC_EVENTS)

export interface DiagnosticEventEntry {
  event: DiagnosticEvent
  /** Coarse timestamp (minute precision) — avoids precise-time fingerprinting. */
  at: string
}

const MAX_EVENTS = 40
const buffer: DiagnosticEventEntry[] = []

/** Truncate an ISO timestamp to minute precision (no seconds/millis). */
function coarseNow(): string {
  // new Date() is available at runtime in the app (this is not a workflow script).
  return new Date().toISOString().slice(0, 16) + 'Z'
}

/**
 * Record a lifecycle event. Silently ignores anything not in the enum, so a bad
 * caller can never inject free-form text. Oldest entries are dropped past the
 * cap.
 */
export function recordDiagnosticEvent(event: DiagnosticEvent): void {
  if (!EVENT_SET.has(event)) return
  buffer.push({ event, at: coarseNow() })
  if (buffer.length > MAX_EVENTS) buffer.shift()
}

/** Return a copy of the recorded events (oldest first). */
export function getDiagnosticEvents(): DiagnosticEventEntry[] {
  return buffer.slice()
}

/** Clear the buffer (used in tests). */
export function clearDiagnosticEvents(): void {
  buffer.length = 0
}
