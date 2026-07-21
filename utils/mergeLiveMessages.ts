import type { Message } from '@/types/api'

/**
 * Merge live (WebSocket) messages onto REST history, deduping by uuid then id.
 *
 * uuid dedup (first pass): a live message whose uuid already appears in history
 * is dropped. ids never match across REST/WS — REST uses index-based ids
 * (`<conv>-<index>`), WS uses the message uuid/timestamp — so a line that
 * arrives over WS and again via the REST drain would otherwise appear twice.
 * History always carries the authoritative uuid, so the WS copy loses.
 *
 * id dedup (second pass): guards uuid-less messages, whose fallback
 * timestamp-type-role ids can still collide across the boundary. A duplicate
 * FlashList key triggers a render loop.
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
  const seenUuids = new Set(orderedHistorical.map((m) => m.uuid).filter(Boolean))
  const newLive = liveMessages.filter((m) => !m.uuid || !seenUuids.has(m.uuid))
  const seen = new Set<string>()
  return [...orderedHistorical, ...middle, ...newLive].filter((m) => {
    if (seen.has(m.id)) return false
    seen.add(m.id)
    return true
  })
}
