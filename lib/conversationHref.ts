/**
 * Builds the conversation detail route. When a search query is active it is
 * appended so the detail screen can resolve an anchored, highlighted window —
 * an empty/whitespace-only search produces the exact URL non-search navigation
 * already uses.
 *
 * `fromSession` marks navigation from a live session (e.g. the resumed-scrollback
 * notice) so the conversation footer can offer "Back to Live Session" instead of
 * Resume.
 */
export function conversationHref(
  id: string,
  serverId: string,
  search?: string,
  opts?: { fromSession?: string },
): string {
  let href = `/conversation/${id}?server=${serverId}`
  const q = search?.trim()
  if (q) href += `&search=${encodeURIComponent(q)}`
  const fromSession = opts?.fromSession?.trim()
  if (fromSession) href += `&fromSession=${encodeURIComponent(fromSession)}`
  return href
}
