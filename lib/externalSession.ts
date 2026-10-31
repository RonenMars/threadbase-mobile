import type { Conversation, Session } from '@/types/api'
import type { SessionTier } from '@/lib/sessionPresentation'

/**
 * A session whose underlying process the streamer does NOT own — a CLI it
 * discovered but only observes. These are read-only: the app must never send
 * input, cancel, or overtake them (overtaking SIGTERMs the user's real
 * terminal). Route them to the read-only conversation view instead of the PTY
 * screen. Additive field; older servers omit `ownership`, so this is false for
 * them and their existing (adopt/overtake) behaviour is preserved.
 */
export function isExternalSession(s: Pick<Session, 'ownership'>): boolean {
  return s.ownership === 'external'
}

/**
 * Whether an external session's process appears to be alive, for the distinct
 * "external — alive" indicator. Keyed on the additive liveness fields, with a
 * pid fallback for older servers that send `pid` for a discovered process but
 * none of the new fields (managed PTY + historical shapes never carry `pid`).
 */
export function isExternalAlive(
  s: Pick<Session, 'processLiveness' | 'activity' | 'pid'>,
): boolean {
  // New-server signals are authoritative when present.
  if (s.processLiveness === 'alive') return true
  if (s.processLiveness === 'gone') return false
  if (s.activity?.state === 'active_writing') return true
  // Older-server fallback: a bare pid with none of the new liveness fields.
  if (s.processLiveness == null && s.activity == null && s.pid != null) return true
  return false
}

/**
 * Narrow the streamer's liveness fields on a conversation row or detail meta.
 * Only the two values this build knows survive; anything else reads as absent.
 */
export function narrowConversationLiveness(raw: {
  ownership?: string
  processLiveness?: string
}): Pick<Conversation, 'ownership' | 'processLiveness'> {
  return {
    ...(raw.ownership === 'external' ? { ownership: 'external' as const } : {}),
    ...(raw.processLiveness === 'alive' ? { processLiveness: 'alive' as const } : {}),
  }
}

/**
 * Tier for a conversation row: `observed` (the existing external-live styling)
 * while its CLI runs outside Threadbase, otherwise none so the row is untouched.
 */
export function conversationTier(
  c: Pick<Conversation, 'ownership' | 'processLiveness'>,
): SessionTier | undefined {
  return c.processLiveness === 'alive' ? 'observed' : undefined
}

/** A summary's live-outside count; a missing or malformed value is 0. */
export function liveExternalCountOf(summary: { liveExternalCount?: number }): number {
  const n = summary.liveExternalCount
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0
}
