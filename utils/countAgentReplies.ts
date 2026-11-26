import type { Message } from '@/types/api'

// A reply is something the agent said to the reader: an assistant message with
// non-empty text. Tool calls, results, thinking, diffs and sub-agent output are
// not replies, and a message that carries text plus a tool call is still one.
function isAgentReply(m: Message): boolean {
  return (
    m.role === 'assistant' &&
    !m.is_sidechain &&
    Array.isArray(m.content) &&
    m.content.some((c) => c.type === 'text' && c.text.trim() !== '')
  )
}

// Parsed, not string-compared: ISO strings with and without milliseconds do not
// sort as instants. An optimistic send carries '' until its echo lands.
function instant(timestamp: string): number | null {
  const ms = Date.parse(timestamp)
  return Number.isNaN(ms) ? null : ms
}

/** Timestamp of the last message that has a usable one, or null. */
export function latestTimestamp(messages: readonly Message[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (instant(messages[i].timestamp) !== null) return messages[i].timestamp
  }
  return null
}

/**
 * Agent replies strictly after `afterTimestamp`. Keyed on the server timestamp
 * rather than a position or id: ids differ between REST and the live stream, and
 * older history can load above a reader who has scrolled up, but a message keeps
 * its timestamp on every path.
 */
export function countAgentRepliesAfter(messages: readonly Message[], afterTimestamp: string): number {
  const after = instant(afterTimestamp)
  if (after === null) return 0
  return messages.filter((m) => {
    const at = instant(m.timestamp)
    return at !== null && at > after && isAgentReply(m)
  }).length
}
