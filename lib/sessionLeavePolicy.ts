export const SESSION_LEAVE_ACTIONS = ['ask', 'kill', 'leave', 'kill_on_idle'] as const
export type SessionLeaveAction = (typeof SESSION_LEAVE_ACTIONS)[number]
export type AppliedSessionLeaveAction = Exclude<SessionLeaveAction, 'ask'>

export const DEFAULT_SESSION_LEAVE_ACTION: SessionLeaveAction = 'ask'
export const DEFAULT_LEAVE_MODAL_CHOICE: AppliedSessionLeaveAction = 'leave'

export interface LeaveSessionSnapshot {
  ptyAttached?: boolean | null
  status?: string | null
}

export type SessionLeaveDecision =
  | { kind: 'none' }
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

export function decideSessionLeave(opts: {
  session: LeaveSessionSnapshot | null | undefined
  setting: unknown
}): SessionLeaveDecision {
  if (!isLiveAttachedPty(opts.session)) {
    return { kind: 'none' }
  }
  const setting = coerceSessionLeaveAction(opts.setting)
  if (setting === 'ask') return { kind: 'prompt' }
  return { kind: 'apply', action: setting }
}

export interface LeaveActionOutcome {
  ok: boolean
  applied: AppliedSessionLeaveAction
}

/**
 * Runs the chosen leave action and reports whether it succeeded.
 * `leave` never touches the server, so it always succeeds; `kill` and
 * `kill_on_idle` await their respective server round trips.
 */
export async function applySessionLeaveAction(opts: {
  action: AppliedSessionLeaveAction
  stopSession: () => Promise<void>
  sendHold: () => Promise<boolean>
}): Promise<LeaveActionOutcome> {
  if (opts.action === 'leave') return { ok: true, applied: 'leave' }
  if (opts.action === 'kill') {
    try {
      await opts.stopSession()
      return { ok: true, applied: 'kill' }
    } catch {
      return { ok: false, applied: 'kill' }
    }
  }
  return { ok: await opts.sendHold(), applied: 'kill_on_idle' }
}
