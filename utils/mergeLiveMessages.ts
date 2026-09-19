import type { Message } from '@/types/api'

/**
 * Live messages that history does not already hold, matched by uuid, then by
 * messageIndex.
 *
 * uuid: ids never match across REST/WS — REST uses index-based ids
 * (`<conv>-<index>`), WS uses the message uuid/timestamp — so a line that
 * arrives over WS and again via the REST drain would otherwise appear twice.
 *
 * messageIndex: REST Cursor messages carry `uuid: null`, so uuid alone lets
 * every live Cursor line survive next to its REST copy after a refetch. A live
 * line's seq is the offset index's `message_index`, the same numbering REST
 * serves. A live line with neither (the initial replay when a Cursor transcript
 * binds) is kept.
 */
export function dropSeenLive(history: Message[], live: Message[]): Message[] {
  const seenUuids = new Set(history.map((m) => m.uuid).filter(Boolean))
  const seenIndexes = new Set(history.map((m) => m.messageIndex).filter((i) => i !== undefined))
  return live.filter(
    (m) =>
      !(m.uuid && seenUuids.has(m.uuid)) &&
      !(m.messageIndex !== undefined && seenIndexes.has(m.messageIndex)),
  )
}

/**
 * Merge live (WebSocket) messages onto REST history: `dropSeenLive`, then an id
 * dedup guarding uuid-less messages, whose fallback timestamp-type-role ids can
 * still collide across the boundary. A duplicate FlashList key triggers a
 * render loop.
 *
 * `middle` is spliced between history and live (the live-session view's
 * optimistic user bubbles); read-only callers omit it. Order is always
 * history → middle → live — live never re-sorts by timestamp/index.
 */
export function mergeLiveMessages(
  orderedHistorical: Message[],
  liveMessages: Message[],
  middle: Message[] = [],
): Message[] {
  const newLive = dropSeenLive(orderedHistorical, liveMessages)
  const seen = new Set<string>()
  return [...orderedHistorical, ...middle, ...newLive].filter((m) => {
    if (seen.has(m.id)) return false
    seen.add(m.id)
    return true
  })
}

/**
 * Name each tool_result after the tool_use with the same id earlier in the list.
 * Codex and Claude put a result in a later message than its call, so neither
 * the per-message REST resolver nor the live parser (which knows no name) can.
 * A result whose call is outside the loaded window keeps the name it came with.
 * Returns new objects for changed messages only; the input is never mutated.
 */
export function resolveToolNames(messages: Message[]): Message[] {
  const names = new Map<string, string>()
  return messages.map((m) => {
    let changed = false
    const content = m.content.map((b) => {
      if (b.type === 'tool_use' && b.id) names.set(b.id, b.name)
      if (b.type !== 'tool_result' || !b.toolUseId) return b
      const name = names.get(b.toolUseId)
      if (!name || name === b.toolName) return b
      changed = true
      return { ...b, toolName: name }
    })
    return changed ? { ...m, content } : m
  })
}
