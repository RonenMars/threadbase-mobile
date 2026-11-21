/**
 * `@` file mentions in the composer: finding the token under the cursor,
 * ranking a directory listing against it, and writing the chosen entry back.
 * Pure — the composer hook and the picker share it, and it is tested alone.
 */
import type { PeerRow } from '@/types/api'

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
  // Mentions are relative to the session's cwd. `..` may walk up: the streamer
  // resolves it and refuses anything outside its browse root (unless it runs
  // with `unrestrictedBrowse`), so the server's check is the guard, not this.
  // `~/` is the server's home directory; it expands it and applies the same root check.
  if (raw.startsWith('/') || raw.startsWith('\\')) return null
  if (raw.startsWith('~') && raw !== '~' && !raw.startsWith('~/')) return null
  // A trailing `..` or a bare `~` already names a folder: list it before the `/` is typed.
  const path = raw === '..' || raw === '~' || raw.endsWith('/..') ? `${raw}/` : raw
  const slash = path.lastIndexOf('/')
  const dir = slash < 0 ? '' : path.slice(0, slash)
  const query = slash < 0 ? path : path.slice(slash + 1)
  if (dir && dir.split('/').some((seg) => seg === '')) return null

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

/**
 * A session's extra directories (`additionalPaths`, absolute) as folders the
 * `@` picker offers beside the cwd's own entries, written relative to the cwd
 * so the mention and the listing both go through `..`. POSIX paths only; a
 * Windows cwd cannot be listed at all (`mentionListingPath`).
 */
export function extraDirEntries(cwd: string, extraDirs: readonly string[], query: string): MentionEntry[] {
  if (!cwd.startsWith('/')) return []
  const split = (p: string) => p.split('/').filter(Boolean)
  const from = split(cwd)
  const q = query.toLowerCase()
  const entries: MentionEntry[] = []
  for (const dir of extraDirs) {
    if (!dir.startsWith('/')) continue
    const to = split(dir)
    let common = 0
    while (common < from.length && common < to.length && from[common] === to[common]) common++
    const up = from.length - common
    if (up === 0) continue // the cwd itself, or inside it: already listed
    const name = [...Array<string>(up).fill('..'), ...to.slice(common)].join('/')
    const base = to[to.length - 1] ?? ''
    if (q && !base.toLowerCase().includes(q)) continue
    entries.push({ name, kind: 'dir' })
  }
  return entries
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

/** A peer Claude session offered in the `@` picker beside paths. */
export interface PeerEntry {
  id: string
  name: string
  projectName: string
  shortId: string
  /** What goes into the prompt: the picker token, followed by the address when the name is shared, or the bare address when there is no token. */
  insert: string
}

function peerNameFromMention(mention: string): string {
  return mention.replace(/^@"?/, '').replace(/"$/, '')
}

/**
 * Peers come from `GET /api/peers`, which lists only sessions that can be
 * messaged. The session being typed in lists itself, so it is dropped. Names are not unique: a mention shared by two rows is followed by
 * the per-session address, which tells the relaying model which one is meant.
 * With no mention (a name the quoted form cannot carry) the bare address is
 * all there is; the CLI never parses `@uds:…` as a mention, so no `@` there.
 */
export function buildPeerEntries(sessions: readonly PeerRow[], selfId: string): PeerEntry[] {
  const peers = sessions.filter(
    (s) => s.id !== selfId && (typeof s.peerMention === 'string' || typeof s.peerAddress === 'string'),
  )
  const mentionCount = new Map<string, number>()
  for (const s of peers) {
    if (s.peerMention) mentionCount.set(s.peerMention, (mentionCount.get(s.peerMention) ?? 0) + 1)
  }
  const entries: PeerEntry[] = []
  for (const s of peers) {
    const shared = s.peerMention !== undefined && mentionCount.get(s.peerMention) !== 1
    const insert = s.peerMention
      ? shared && s.peerAddress
        ? `${s.peerMention} ${s.peerAddress}`
        : s.peerMention
      : s.peerAddress
    if (!insert) continue
    entries.push({
      id: s.id,
      name: s.peerMention ? peerNameFromMention(s.peerMention) : s.name,
      projectName: s.projectName,
      shortId: s.id.slice(0, 8),
      insert,
    })
  }
  return entries
}

export function rankPeerEntries(peers: readonly PeerEntry[], query: string, limit: number = MENTION_RESULT_LIMIT): PeerEntry[] {
  const q = query.toLowerCase()
  const scored: { peer: PeerEntry; score: number; index: number }[] = []
  peers.forEach((peer, index) => {
    const name = peer.name.toLowerCase()
    let score: number
    if (!q || name.startsWith(q)) score = 0
    else if (name.includes(q) || peer.projectName.toLowerCase().includes(q) || peer.shortId.startsWith(q)) score = 1
    else return
    scored.push({ peer, score, index })
  })
  scored.sort((a, b) => a.score - b.score || a.index - b.index)
  return scored.slice(0, limit).map((s) => s.peer)
}

/** Replace the token with the peer's address and a trailing space; the picker then closes. */
export function applyPeerMention(text: string, token: MentionToken, peer: PeerEntry): { text: string; cursor: number } {
  const before = text.slice(0, token.start)
  const after = text.slice(token.end)
  const separator = /^\s/.test(after) ? '' : ' '
  return {
    text: before + peer.insert + separator + after,
    cursor: before.length + peer.insert.length + 1,
  }
}
