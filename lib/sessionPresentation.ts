import type { Session, UnavailableReason } from '@/types/api'
import { isExternalAlive, isExternalSession } from '@/lib/externalSession'

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
}

/** Fields the presentation helper needs from a session (or session-like) row. */
export type SessionPresentationInput = {
  /** Runtime may still emit legacy / on_hold values not in SessionStatus. */
  status: string
  ownership?: Session['ownership']
  processLiveness?: Session['processLiveness']
  activity?: Session['activity']
  pid?: Session['pid']
  ptyAttached?: boolean
  resumedFromConversationId?: Session['resumedFromConversationId']
  completedAt?: Session['completedAt']
  failureReason?: Session['failureReason']
}

export interface ConversationPresentationInput {
  resumable?: boolean | null
  unavailableReason?: UnavailableReason | null
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

/**
 * Derive a single presentation model for badges, live pills, and action gates.
 */
export function deriveSessionPresentation(
  session: SessionPresentationInput,
): SessionPresentation {
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

  if (session.ownership === 'historical' || (external && !externalAlive)) {
    return {
      kind: 'historical',
      labelKey: 'status.historical',
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
    }
  }
  return null
}

/** Shared “is this row live?” including external-alive. */
export function isPresentationLive(session: SessionPresentationInput): boolean {
  return deriveSessionPresentation(session).live
}
