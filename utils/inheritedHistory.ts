// Wire shape of `meta.inherited_history` — a Codex session created by
// `codex fork` continues an earlier conversation, and the server serves the
// parent's messages ahead of the fork's own in one continuous message_index
// space. Every field is optional and loosely typed on purpose: this is
// untrusted server input, narrowed by inheritedHistorySeam below.
export interface RawInheritedHistory {
  source_id?: string
  source_provider?: string
  through_message_index?: number
  forked_at?: string
  unavailable_reason?: string | null
}

/** What the message list should draw for the inherited/own boundary, if anything. */
export type InheritedHistorySeam =
  | { kind: 'divider'; beforeMessageIndex: number; forkedAt?: string }
  | { kind: 'unavailable' }

export function inheritedHistorySeam(
  raw: RawInheritedHistory | null | undefined,
): InheritedHistorySeam | undefined {
  if (!raw || typeof raw !== 'object') return undefined

  if (raw.unavailable_reason === 'source_missing') return { kind: 'unavailable' }

  const index = raw.through_message_index
  if (typeof index !== 'number' || !Number.isInteger(index) || index <= 0) return undefined

  const forkedAt = typeof raw.forked_at === 'string' && raw.forked_at ? raw.forked_at : undefined
  return { kind: 'divider', beforeMessageIndex: index, forkedAt }
}
