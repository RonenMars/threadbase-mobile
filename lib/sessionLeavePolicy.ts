export const SESSION_LEAVE_ACTIONS = ['ask', 'kill', 'leave', 'kill_on_idle'] as const
export type SessionLeaveAction = (typeof SESSION_LEAVE_ACTIONS)[number]
export type AppliedSessionLeaveAction = Exclude<SessionLeaveAction, 'ask'>

export const DEFAULT_SESSION_LEAVE_ACTION: SessionLeaveAction = 'ask'
export const DEFAULT_LEAVE_MODAL_CHOICE: AppliedSessionLeaveAction = 'leave'

export interface LeaveSessionSnapshot {
  ptyAttached?: boolean | null
  status?: string | null
  promptCount?: number | null
  resumedFromConversationId?: string | null
}

export type SessionLeaveDecision =
  | { kind: 'none' }
  | { kind: 'discard_unused' }
  | { kind: 'prompt' }
  | { kind: 'apply'; action: AppliedSessionLeaveAction }

export function isSessionLeaveAction(value: unknown): value is SessionLeaveAction {
  return (
    value === 'ask' || value === 'kill' || value === 'leave' || value === 'kill_on_idle'
  )
}

export function coerceSessionLeaveAction(value: unknown): SessionLeaveAction {
  return isSessionLeaveAction(value) ? value : DEFAULT_SESSION_LEAVE_ACTION
}

/** Live PTY this build can act on. Unknown statuses degrade to not-live. */
export function isLiveAttachedPty(session: LeaveSessionSnapshot | null | undefined): boolean {
  if (session?.ptyAttached !== true) return false
  return session.status === 'running' || session.status === 'waiting_input'
}

export function isUnusedEmptyDiscard(
  session: LeaveSessionSnapshot | null | undefined,
  wasUsed: boolean,
): boolean {
  if (!isLiveAttachedPty(session) || session == null) return false
  return (
    (session.promptCount ?? 0) === 0 &&
    !session.resumedFromConversationId &&
    !wasUsed
  )
}

export function decideSessionLeave(opts: {
  session: LeaveSessionSnapshot | null | undefined
  wasUsed: boolean
  setting: unknown
}): SessionLeaveDecision {
  if (isUnusedEmptyDiscard(opts.session, opts.wasUsed)) {
    return { kind: 'discard_unused' }
  }
  if (!isLiveAttachedPty(opts.session)) {
    return { kind: 'none' }
  }
  const setting = coerceSessionLeaveAction(opts.setting)
  if (setting === 'ask') return { kind: 'prompt' }
  return { kind: 'apply', action: setting }
}

export type LeaveApplyResult = AppliedSessionLeaveAction | 'leave_fallback'

export function applySessionLeaveAction(opts: {
  action: AppliedSessionLeaveAction
  stopSession: () => void
  sendHold: () => boolean
}): LeaveApplyResult {
  if (opts.action === 'kill') {
    opts.stopSession()
    return 'kill'
  }
  if (opts.action === 'leave') {
    return 'leave'
  }
  if (opts.sendHold()) {
    return 'kill_on_idle'
  }
  return 'leave_fallback'
}

const LEAVE_IN_FLIGHT_TTL_MS = 2_000
const leaveInFlight = new Map<string, number>()

export function markSessionLeaveInFlight(sessionId: string, now = Date.now()): void {
  if (!sessionId) return
  leaveInFlight.set(sessionId, now)
}

export function isSessionLeaveInFlight(sessionId: string, now = Date.now()): boolean {
  const started = leaveInFlight.get(sessionId)
  if (started === undefined) return false
  if (now - started > LEAVE_IN_FLIGHT_TTL_MS) {
    leaveInFlight.delete(sessionId)
    return false
  }
  return true
}

export function clearSessionLeaveInFlight(sessionId: string): void {
  leaveInFlight.delete(sessionId)
}
