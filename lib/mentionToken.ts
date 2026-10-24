/**
 * `@` file mentions in the composer: finding the token under the cursor,
 * ranking a directory listing against it, and writing the chosen entry back.
 * Pure — the composer hook and the picker share it, and it is tested alone.
 */

export interface MentionToken {
  /** Index of the `@`. */
  start: number
  /** End of the whole token (exclusive), which can lie past the cursor. */
  end: number
  /** Directory part, relative to the session cwd, unescaped; '' for the cwd itself. */
  dir: string
  /** Text after the last `/`, up to the cursor, unescaped. */
  query: string
}

export type MentionEntryKind = 'dir' | 'file'

export interface MentionEntry {
  name: string
  kind: MentionEntryKind
}

export const MENTION_RESULT_LIMIT = 50

// Claude Code's `@path` parser splits on whitespace; a backslash keeps a space
// inside the path. Attachments are sent the same way.
export function escapeMentionPath(path: string): string {
  return path.replace(/ /g, '\\ ')
}

function unescapeMentionPath(path: string): string {
  return path.replace(/\\ /g, ' ')
}

function isEscapedSpace(text: string, index: number): boolean {
  return text[index] === ' ' && index > 0 && text[index - 1] === '\\'
}

export function findMentionToken(text: string, cursor: number): MentionToken | null {
  const caret = Math.min(Math.max(cursor, 0), text.length)
  let start = -1
  for (let i = caret - 1; i >= 0; i--) {
    const ch = text[i]
    if (ch === '@') {
      // An `@` inside a word (an email, `npm i pkg@1`) is not a mention.
      if (i > 0 && !/\s/.test(text[i - 1])) return null
      start = i
      break
    }
    if (/\s/.test(ch) && !isEscapedSpace(text, i)) return null
  }
  if (start < 0) return null

  let end = caret
  while (end < text.length && (!/\s/.test(text[end]) || isEscapedSpace(text, end))) end++

  const raw = unescapeMentionPath(text.slice(start + 1, caret))
  // Mentions are relative to the session's cwd; the server's root check is the
  // real guard, this only keeps the picker from offering what it cannot list.
  if (raw.startsWith('/') || raw.startsWith('~') || raw.startsWith('\\')) return null
  const slash = raw.lastIndexOf('/')
  const dir = slash < 0 ? '' : raw.slice(0, slash)
  const query = slash < 0 ? raw : raw.slice(slash + 1)
  if (dir && dir.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')) return null

  return { start, end, dir, query }
}

export function rankMentionEntries(
  entries: readonly MentionEntry[],
  query: string,
  limit: number = MENTION_RESULT_LIMIT,
): MentionEntry[] {
  const q = query.toLowerCase()
  const showHidden = q.startsWith('.')
  const scored: { entry: MentionEntry; score: number; index: number }[] = []
  entries.forEach((entry, index) => {
    if (!showHidden && entry.name.startsWith('.')) return
    const name = entry.name.toLowerCase()
    let match: number
    if (!q || name.startsWith(q)) match = 0
    else if (name.includes(q)) match = 1
    else return
    scored.push({ entry, score: match * 2 + (entry.kind === 'dir' ? 0 : 1), index })
  })
  scored.sort((a, b) => a.score - b.score || a.index - b.index)
  return scored.slice(0, limit).map((s) => s.entry)
}

export function mentionPath(token: MentionToken, entry: MentionEntry): string {
  return token.dir ? `${token.dir}/${entry.name}` : entry.name
}

/**
 * Replace the token with the chosen entry. A directory keeps the token open
 * (`@src/`) so the picker drills into it; a file closes it with a space.
 */
export function applyMention(
  text: string,
  token: MentionToken,
  entry: MentionEntry,
): { text: string; cursor: number } {
  const path = escapeMentionPath(mentionPath(token, entry))
  const before = text.slice(0, token.start)
  const after = text.slice(token.end)
  if (entry.kind === 'dir') {
    const inserted = `@${path}/`
    return { text: before + inserted + after, cursor: before.length + inserted.length }
  }
  const inserted = `@${path}`
  const separator = /^\s/.test(after) ? '' : ' '
  return {
    text: before + inserted + separator + after,
    cursor: before.length + inserted.length + 1,
  }
}
