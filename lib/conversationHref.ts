/**
 * Builds the conversation detail route. When a search query is active it is
 * appended so the detail screen can resolve an anchored, highlighted window —
 * an empty/whitespace-only search produces the exact URL non-search navigation
 * already uses.
 */
export function conversationHref(id: string, serverId: string, search?: string): string {
  const base = `/conversation/${id}?server=${serverId}`
  const q = search?.trim()
  return q ? `${base}&search=${encodeURIComponent(q)}` : base
}
