// Path display helper for ConversationListItem and project cards.
//
// The list rows in this app are dominated by filesystem paths because most
// conversations do not carry a separate human-readable title. This helper
// turns a raw path into two strings — a primary "suffix" that disambiguates
// the row, and a "parent" that provides context — under four modes.
//
// Decisions captured in design/plans/conversation-list-redesign.md §2.

export type PathDisplayMode = 'smart' | 'full' | 'suffix' | 'last-segment'

export interface PathDisplayResult {
  /** Primary line: what the user reads first. Never empty for a non-empty input. */
  suffix: string
  /** Optional muted parent shown above/under the suffix. */
  parent?: string
  /** True when the input was tail-truncated (the leftmost segments were dropped). */
  truncated: boolean
}

export interface PathDisplayOptions {
  mode?: PathDisplayMode
  /**
   * Other visible paths on the same screen. Required for `smart` mode so we can
   * compute the shortest unique trailing suffix. Empty array == treat as unique.
   */
  siblings?: readonly string[]
  /**
   * Hard cap on the parent string. Default 28 characters — fits a 390px row
   * comfortably with mono 11pt. Leftmost segments are dropped first.
   */
  parentMaxChars?: number
  /**
   * How many trailing segments to keep when mode === 'suffix'. Default 2.
   */
  suffixSegments?: number
}

// Splits the path into clean segments, dropping a trailing slash and the
// home-directory prefix if present ("~/foo/bar" -> ["foo", "bar"]). The
// leading "/" of an absolute path is stripped too — we don't visually
// distinguish absolute from relative in list rows.
function segments(path: string): string[] {
  if (!path) return []
  let p = path.trim()
  if (p.endsWith('/')) p = p.slice(0, -1)
  if (p.startsWith('~/')) p = p.slice(2)
  if (p.startsWith('/')) p = p.slice(1)
  return p.split('/').filter(Boolean)
}

/**
 * Tail-truncate from the LEFT until the joined path fits within `maxChars`.
 * Drops leftmost segments first so the rightmost (most informative) segments
 * stay visible. Prepends "…/" when anything was dropped.
 */
function truncateLeft(parts: string[], maxChars: number): { text: string; truncated: boolean } {
  if (parts.length === 0) return { text: '', truncated: false }
  const joined = parts.join('/')
  if (joined.length <= maxChars) return { text: joined, truncated: false }

  // Drop leading segments until the (re)joined string fits.
  let working = parts.slice()
  while (working.length > 1 && ('…/' + working.slice(1).join('/')).length > maxChars) {
    working = working.slice(1)
  }
  // Edge case: even a single trailing segment exceeds maxChars — hard truncate.
  if (working.length <= 1 && working[0].length > maxChars) {
    return { text: '…' + working[0].slice(-Math.max(1, maxChars - 1)), truncated: true }
  }
  return { text: '…/' + working.slice(1).join('/'), truncated: true }
}

/**
 * Find the shortest trailing suffix of `parts` that is unique among siblings.
 * Returns the number of trailing segments to use.
 *
 * Example: paths "a/b/foo" and "c/d/foo" → both have last segment "foo"; we
 * walk back until "b/foo" vs "d/foo" disambiguates, returning 2.
 */
function shortestUniqueSuffixLength(parts: string[], siblings: readonly string[]): number {
  if (parts.length === 0) return 0
  if (siblings.length === 0) return 1

  const siblingSegs = siblings.map(segments)
  for (let take = 1; take <= parts.length; take++) {
    const suffix = parts.slice(parts.length - take).join('/')
    const collision = siblingSegs.some((s) => {
      if (s.join('/') === parts.join('/')) return false // ignore self
      if (s.length < take) return false
      return s.slice(s.length - take).join('/') === suffix
    })
    if (!collision) return take
  }
  return parts.length
}

export function pathDisplay(
  rawPath: string | null | undefined,
  options: PathDisplayOptions = {},
): PathDisplayResult {
  if (!rawPath) return { suffix: '', truncated: false }
  const mode: PathDisplayMode = options.mode ?? 'smart'
  const parentMax = options.parentMaxChars ?? 28
  const parts = segments(rawPath)

  if (parts.length === 0) return { suffix: '', truncated: false }

  if (mode === 'full') {
    // Last segment is the suffix; everything before it is the parent.
    const leaf = parts[parts.length - 1]
    const head = parts.slice(0, parts.length - 1)
    if (head.length === 0) return { suffix: leaf, truncated: false }
    const parent = truncateLeft(head, parentMax)
    return { suffix: leaf, parent: parent.text, truncated: parent.truncated }
  }

  if (mode === 'last-segment') {
    return { suffix: parts[parts.length - 1] || rawPath, truncated: false }
  }

  if (mode === 'suffix') {
    const segCount = Math.max(1, options.suffixSegments ?? 2)
    const tail = parts.slice(Math.max(0, parts.length - segCount)).join('/')
    const head = parts.slice(0, Math.max(0, parts.length - segCount))
    if (head.length === 0) return { suffix: tail, truncated: false }
    const parent = truncateLeft(head, parentMax)
    return { suffix: tail, parent: parent.text, truncated: parent.truncated }
  }

  // smart: shortest unique trailing suffix among siblings.
  const take = shortestUniqueSuffixLength(parts, options.siblings ?? [])
  const tail = parts.slice(parts.length - take).join('/')
  const head = parts.slice(0, parts.length - take)
  if (head.length === 0) return { suffix: tail, truncated: false }
  const parent = truncateLeft(head, parentMax)
  return { suffix: tail, parent: parent.text, truncated: parent.truncated }
}
