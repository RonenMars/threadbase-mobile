/**
 * Builds the conversation detail route. When a search query is active it is
 * appended so the detail screen can resolve an anchored, highlighted window —
 * an empty/whitespace-only search produces the exact URL non-search navigation
 * already uses.
 *
 * `fromSession` marks navigation from a live session (e.g. the resumed-scrollback
 * notice) so the conversation footer can offer "Back to Live Session" instead of
 * Resume.
 *
 * `openSearch` opens the in-chat search bar and focuses the input (keyboard up)
 * without running a query yet.
 */
export function conversationHref(
  id: string,
  serverId: string,
  search?: string,
  opts?: { fromSession?: string; openSearch?: boolean },
): string {
  let href = `/conversation/${id}?server=${serverId}`
  const q = search?.trim()
  if (q) href += `&search=${encodeURIComponent(q)}`
  const fromSession = opts?.fromSession?.trim()
  if (fromSession) href += `&fromSession=${encodeURIComponent(fromSession)}`
  if (opts?.openSearch) href += '&openSearch=1'
  return href
}
