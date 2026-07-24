/**
 * Client-only heuristics for whether normalized chat can be treated as
 * authoritative. Never invent streamer APIs — prefer raw terminal when unsure.
 */

export type ParseConfidence = 'high' | 'low'

export type RenderSurfaceMode = 'terminal' | 'chat'

export type PreferRawReason =
  | 'user_preference'
  | 'no_conversation'
  | 'low_parse_confidence'
  | 'chat_empty_pty_active'

export interface PreferRawTerminalInput {
  sessionView: 'chat' | 'terminal'
  hasConversationId: boolean
  conversationMessageCount: number
  ptyVisibleLineCount: number
  parseConfidence: ParseConfidence
}

export interface PreferRawTerminalResult {
  mode: RenderSurfaceMode
  reason: PreferRawReason
  /** When true, UI must not present chat bubbles as ground truth. */
  chatAuthoritative: boolean
}

const PTY_ACTIVE_WITHOUT_CHAT_THRESHOLD = 24

export function preferRawTerminal(input: PreferRawTerminalInput): PreferRawTerminalResult {
  if (!input.hasConversationId) {
    return { mode: 'terminal', reason: 'no_conversation', chatAuthoritative: false }
  }
  if (input.parseConfidence === 'low') {
    return { mode: 'terminal', reason: 'low_parse_confidence', chatAuthoritative: false }
  }
  if (
    input.sessionView === 'chat' &&
    input.conversationMessageCount === 0 &&
    input.ptyVisibleLineCount >= PTY_ACTIVE_WITHOUT_CHAT_THRESHOLD
  ) {
    return { mode: 'terminal', reason: 'chat_empty_pty_active', chatAuthoritative: false }
  }
  if (input.sessionView === 'terminal') {
    return { mode: 'terminal', reason: 'user_preference', chatAuthoritative: false }
  }
  return { mode: 'chat', reason: 'user_preference', chatAuthoritative: true }
}

/** Map unsupported/truncated escape pressure into a coarse confidence band. */
export function parseConfidenceFromCounters(input: {
  unsupportedSequenceCount: number
  truncatedEscapeCount: number
  bytesFed: number
}): ParseConfidence {
  const { unsupportedSequenceCount, truncatedEscapeCount, bytesFed } = input
  if (bytesFed < 64) return 'high'
  if (truncatedEscapeCount > 3) return 'low'
  if (unsupportedSequenceCount >= 12) return 'low'
  if (bytesFed > 0 && unsupportedSequenceCount / Math.max(1, Math.floor(bytesFed / 256)) > 4) {
    return 'low'
  }
  return 'high'
}
