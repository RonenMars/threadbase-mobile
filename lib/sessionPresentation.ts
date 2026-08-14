import type { AgentPhase, SessionLifecycle, SessionStatus, UnavailableReason } from '@/types/api'

/**
 * Wire statuses this build knows how to render. Wider than `SessionStatus`:
 * the streamer also emits the terminal/hold values below, which
 * `deriveSessionPresentation` handles explicitly.
 */
const UNDERSTOOD_STATUSES: readonly string[] = [
  'running',
  'waiting_input',
  'idle',
  'on_hold',
  'completed',
  'failed',
]

/**
 * A server can emit a status this build has never heard of (CLAUDE.md →
 * "Server contract — degrade, don't break"). Flatten anything unrecognised to
 * `idle` at the parsing boundary so it never reaches code that assumes the
 * union is exhaustive. The cast covers the values above that the declared
 * three-value union does not yet name.
 */
export function narrowSessionStatus(status: string): SessionStatus {
  return (UNDERSTOOD_STATUSES.includes(status) ? status : 'idle') as SessionStatus
}

/**
 * Canonical session/conversation presentation kinds for hub rows, badges, and
 * the session status bar. Derived only from existing wire fields — no private API.
 */
export type SessionKind =
  | 'managed_live'
  | 'external_live'
  | 'historical'
  | 'resumed'
  | 'on_hold'
  | 'completed'
  | 'unavailable'
  | 'stale'
  | 'idle'

export type SessionColorToken = 'running' | 'waiting' | 'completed' | 'idle' | 'failed'

export type SessionConfidence = 'process' | 'jsonl' | 'status' | 'unknown'

export interface SessionCapabilities {
  canSendInput: boolean
  canCancel: boolean
  canOvertake: boolean
  canResume: boolean
  isObserveOnly: boolean
}

export type SessionStatusLabelKey =
  | 'status.running'
  | 'status.waiting'
  | 'status.idle'
  | 'status.externalLive'
  | 'status.historical'
  | 'status.interrupted'
  | 'status.interruptedWaiting'
  | 'status.resumed'
  | 'status.onHold'
  | 'status.completed'
  | 'status.failed'
  | 'status.unavailablePath'
  | 'status.unavailableWorktree'
  | 'status.stale'

export interface SessionPresentation {
  kind: SessionKind
  labelKey: SessionStatusLabelKey
  live: boolean
  externalLive: boolean
  colorToken: SessionColorToken
  confidence: SessionConfidence
  activityAt: string | null
  capabilities: SessionCapabilities
  /** Server-derived agent phase, already gated on `live`. Null when there is none. */
  subStatus: AgentPhase | null
}

/** Fields the presentation helper needs from a session (or session-like) row. */
export type SessionPresentationInput = {
  /** Runtime may still emit legacy / on_hold values not in SessionStatus. */
  status: string
  ownership?: 'managed' | 'external' | 'historical'
  processLiveness?: 'alive' | 'gone' | 'unknown'
  interruptedStatus?: 'running' | 'waiting_input'
  activity?: { state: 'active_writing' | 'quiet'; lastEventAt: string; source: 'jsonl' }
  pid?: number
  ptyAttached?: boolean
  resumedFromConversationId?: string | null
  completedAt?: string
  failureReason?: string
  /** Process-lifetime axis from the streamer. Additive; older servers omit it. */
  lifecycle?: SessionLifecycle
  /** Agent phase within a running turn. Optional here: session-like rows omit it. */
  subStatus?: AgentPhase | null
}

export interface ConversationPresentationInput {
  resumable?: boolean | null
  unavailableReason?: UnavailableReason | null
}

function isExternalSession(s: Pick<SessionPresentationInput, 'ownership'>): boolean {
  return s.ownership === 'external'
}

function isExternalAlive(
  s: Pick<SessionPresentationInput, 'processLiveness' | 'activity' | 'pid'>,
): boolean {
  if (s.processLiveness === 'alive') return true
  if (s.processLiveness === 'gone') return false
  if (s.activity?.state === 'active_writing') return true
  if (s.processLiveness == null && s.activity == null && s.pid != null) return true
  return false
}

const OBSERVE_ONLY: SessionCapabilities = {
  canSendInput: false,
  canCancel: false,
  canOvertake: false,
  canResume: false,
  isObserveOnly: true,
}

const MANAGED_LIVE_CAPS: SessionCapabilities = {
  canSendInput: true,
  canCancel: true,
  canOvertake: false,
  canResume: false,
  isObserveOnly: false,
}

const IDLE_MANAGED_CAPS: SessionCapabilities = {
  canSendInput: false,
  canCancel: false,
  canOvertake: false,
  canResume: false,
  isObserveOnly: false,
}

function confidenceFor(session: SessionPresentationInput): SessionConfidence {
  if (session.processLiveness === 'alive' || session.processLiveness === 'gone') return 'process'
  if (session.activity?.source === 'jsonl') return 'jsonl'
  if (session.status) return 'status'
  return 'unknown'
}

function activityAtFor(session: SessionPresentationInput): string | null {
  return session.activity?.lastEventAt ?? session.completedAt ?? null
}

const AGENT_PHASES: AgentPhase[] = ['thinking', 'streaming', 'hooks', 'acting', 'working']

function isAgentPhase(value: string | null | undefined): value is AgentPhase {
  return value != null && (AGENT_PHASES as string[]).includes(value)
}

/**
 * Derive a single presentation model for badges, live pills, and action gates.
 */
export function deriveSessionPresentation(
  session: SessionPresentationInput,
): SessionPresentation {
  const presentation = classifySession(session)
  // Gate the phase on `live` here, so no caller re-derives liveness and no phase
  // can render beside a badge that says Idle / External / Stale. An unrecognised
  // value from a newer server means "no phase" — never coerce it.
  return {
    ...presentation,
    subStatus:
      presentation.live && isAgentPhase(session.subStatus) ? session.subStatus : null,
  }
}

function classifySession(
  session: SessionPresentationInput,
): Omit<SessionPresentation, 'subStatus'> {
  const external = isExternalSession(session)
  const externalAlive = external && isExternalAlive(session)
  const status = session.status
  const confidence = confidenceFor(session)
  const activityAt = activityAtFor(session)
  const resumed = Boolean(session.resumedFromConversationId)

  if (status === 'on_hold') {
    return {
      kind: 'on_hold',
      labelKey: 'status.onHold',
      live: false,
      externalLive: false,
      colorToken: 'waiting',
      confidence,
      activityAt,
      capabilities: { ...IDLE_MANAGED_CAPS, canSendInput: false, canCancel: true },
    }
  }

  // Prefer streamer `lifecycle` when present — `completedAt` is stamped on both
  // a real exit and a hold, so it cannot separate these two branches.
  if (session.lifecycle === 'completed' || session.lifecycle === 'failed') {
    return {
      kind: 'completed',
      labelKey:
        session.lifecycle === 'failed' || session.failureReason
          ? 'status.failed'
          : 'status.completed',
      live: false,
      externalLive: false,
      colorToken:
        session.lifecycle === 'failed' || session.failureReason ? 'failed' : 'completed',
      confidence,
      activityAt,
      capabilities: IDLE_MANAGED_CAPS,
    }
  }

  if (status === 'completed' || status === 'failed') {
    if (status === 'failed' || session.failureReason) {
      return {
        kind: 'completed',
        labelKey: 'status.failed',
        live: false,
        externalLive: false,
        colorToken: 'failed',
        confidence,
        activityAt,
        capabilities: IDLE_MANAGED_CAPS,
      }
    }
    return {
      kind: 'completed',
      labelKey: 'status.completed',
      live: false,
      externalLive: false,
      colorToken: 'completed',
      confidence,
      activityAt,
      capabilities: IDLE_MANAGED_CAPS,
    }
  }

  if (externalAlive) {
    return {
      kind: 'external_live',
      labelKey: 'status.externalLive',
      live: true,
      externalLive: true,
      colorToken: 'completed',
      confidence: session.processLiveness ? 'process' : confidence,
      activityAt,
      capabilities: OBSERVE_ONLY,
    }
  }

  if (external && session.processLiveness === 'gone') {
    return {
      kind: 'stale',
      labelKey: 'status.stale',
      live: false,
      externalLive: false,
      colorToken: 'idle',
      confidence: 'process',
      activityAt,
      capabilities: OBSERVE_ONLY,
    }
  }

  // Held / rehydrated / historical: no live process, resume from conversation.
  // `lifecycle: "resumable"` is the streamer's signal for a hold (and for
  // rehydrated stubs); do not conflate it with `completed` / `failed`.
  if (
    session.lifecycle === 'resumable' ||
    session.ownership === 'historical' ||
    (external && !externalAlive)
  ) {
    // A rehydrated stub's `status` had to flatten to `idle`; `interruptedStatus`
    // is the streamer telling us what it was actually doing when it stopped it.
    // Label only — kind, colour and capabilities stay put, so the row is still
    // idle and still needs a resume tap.
    const historicalLabelKey: SessionStatusLabelKey =
      session.interruptedStatus === 'running'
        ? 'status.interrupted'
        : session.interruptedStatus === 'waiting_input'
          ? 'status.interruptedWaiting'
          : 'status.historical'
    return {
      kind: 'historical',
      labelKey: historicalLabelKey,
      live: false,
      externalLive: false,
      colorToken: 'idle',
      confidence,
      activityAt,
      capabilities: {
        ...OBSERVE_ONLY,
        canResume: true,
      },
    }
  }

  if (status === 'running' || status === 'waiting_input') {
    if (resumed) {
      return {
        kind: 'resumed',
        labelKey: 'status.resumed',
        live: true,
        externalLive: false,
        colorToken: status === 'waiting_input' ? 'waiting' : 'running',
        confidence,
        activityAt,
        capabilities: MANAGED_LIVE_CAPS,
      }
    }
    return {
      kind: 'managed_live',
      labelKey: status === 'waiting_input' ? 'status.waiting' : 'status.running',
      live: true,
      externalLive: false,
      colorToken: status === 'waiting_input' ? 'waiting' : 'running',
      confidence,
      activityAt,
      capabilities: MANAGED_LIVE_CAPS,
    }
  }

  return {
    kind: 'idle',
    labelKey: 'status.idle',
    live: false,
    externalLive: false,
    colorToken: 'idle',
    confidence,
    activityAt,
    capabilities: IDLE_MANAGED_CAPS,
  }
}

export function deriveConversationPresentation(
  conversation: ConversationPresentationInput,
): SessionPresentation | null {
  if (conversation.resumable === false && conversation.unavailableReason) {
    return {
      kind: 'unavailable',
      labelKey:
        conversation.unavailableReason === 'worktree_removed'
          ? 'status.unavailableWorktree'
          : 'status.unavailablePath',
      live: false,
      externalLive: false,
      colorToken: 'failed',
      confidence: 'status',
      activityAt: null,
      capabilities: {
        canSendInput: false,
        canCancel: false,
        canOvertake: false,
        canResume: false,
        isObserveOnly: true,
      },
      subStatus: null,
    }
  }
  return null
}

/** Shared “is this row live?” including external-alive. */
export function isPresentationLive(session: SessionPresentationInput): boolean {
  return deriveSessionPresentation(session).live
}

export type SessionPhase = 'starting' | 'live' | 'ended' | 'resumable'

/**
 * Coarse client phase derived from the streamer's `lifecycle` when present.
 *
 * `ptyAttached === false && status === 'idle'` is ambiguous on its own: it is
 * equally true of a held (still-resumable) session and one that has genuinely
 * ended, and `completedAt` is stamped on both. Prefer `lifecycle`.
 *
 * Without `lifecycle`, fall back to attach/status only — never to `completedAt`.
 */
export function sessionPhase(s: SessionPresentationInput): SessionPhase {
  switch (s.lifecycle) {
    case 'attached':
    case 'detached':
    case 'orphaned':
      return 'live'
    case 'resumable':
      return 'resumable'
    case 'completed':
    case 'failed':
      return 'ended'
    default:
      break
  }
  if (s.ptyAttached) return 'live'
  return s.status === 'idle' ? 'starting' : 'live'
}

/**
 * Conversation history is the right surface when there is no live process to
 * attach to — both a genuine end and a hold/rehydrate (resume lives there).
 */
export function sessionOpensAsHistory(s: SessionPresentationInput): boolean {
  if (s.lifecycle != null) {
    const phase = sessionPhase(s)
    return phase === 'ended' || phase === 'resumable'
  }
  return s.ptyAttached === false && s.status === 'idle'
}
