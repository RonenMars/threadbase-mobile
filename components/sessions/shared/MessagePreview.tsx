import { Text, StyleSheet } from 'react-native'
import { font, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import type { SearchHighlight, SearchMatch } from '@/types/api'

export type MessagePreviewMode = 'first' | 'last' | 'auto' | 'none'

export interface MessagePreviewProps {
  mode?: MessagePreviewMode
  firstMessage?: { text: string } | null
  lastMessage?: { text: string } | null
  /** Server-supplied summary, used as a fallback when first/last are absent. */
  preview?: string | null
  /** Last raw output line from a running session, used as the lowest fallback. */
  lastOutput?: string | null
  messageCount?: number
  /** Character cap on the rendered text. Default 80. */
  maxChars?: number
  /** Optional substring highlight for search results. */
  highlight?: string
  /**
   * `/api/search` matches for this row. A usable match outranks every other
   * source and renders as a two-line contextual excerpt.
   */
  matches?: SearchMatch[] | null
  /**
   * The row's visible title. A metadata match whose snippet merely repeats it
   * is dropped — the title carries the highlight, so echoing it below costs a
   * line and says nothing.
   */
  rowTitle?: string | null
}

interface SnippetPart {
  text: string
  match: boolean
}

const DEFAULT_MAX = 80

function pickText(props: MessagePreviewProps): string | null {
  const { mode = 'auto', firstMessage, lastMessage, preview, lastOutput, messageCount = 0 } = props

  if (mode === 'none') return null

  let chosen: string | null = null
  if (mode === 'first') chosen = firstMessage?.text ?? null
  else if (mode === 'last') chosen = lastMessage?.text ?? null
  else {
    // auto: first when the conversation is short, last once it has grown.
    chosen = messageCount <= 3 ? firstMessage?.text ?? null : lastMessage?.text ?? null
  }

  if (chosen) return chosen
  if (preview) return preview
  if (lastOutput) return lastOutput
  return null
}

/** Strip newlines and collapse whitespace so a multi-line message renders on one row. */
function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function normaliseForCompare(text: string): string {
  return text.replace(/^(?:…|\.\.\.)/, '').replace(/(?:…|\.\.\.)$/, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * Body hits win over metadata hits; position is not relied on. A metadata hit
 * that only restates `rowTitle` is skipped: when a conversation has no session
 * name the title falls back to the project path, so a `projectName` hit would
 * print the title twice.
 */
export function pickMatch(
  matches: SearchMatch[] | null | undefined,
  rowTitle?: string | null,
): SearchMatch | null {
  const usable = (matches ?? []).filter((m) => typeof m?.snippet === 'string' && m.snippet.trim().length > 0)
  const title = rowTitle ? normaliseForCompare(rowTitle) : null
  return (
    usable.find((m) => m.field === 'content') ??
    usable.find((m) => !title || normaliseForCompare(m.snippet) !== title) ??
    null
  )
}

/**
 * Split a snippet on its highlight ranges. Offsets come off the wire, so a range
 * that is malformed, out of bounds or overlapping its predecessor is dropped —
 * the snippet still renders, just with less emphasis.
 *
 * Whitespace is collapsed per part rather than up front: normalising the whole
 * snippet first would shift every offset.
 */
function splitSnippet(snippet: string, highlights: SearchHighlight[] | undefined): SnippetPart[] {
  const ranges = (highlights ?? [])
    .filter(
      (h) =>
        Number.isInteger(h?.start) &&
        Number.isInteger(h?.end) &&
        h.start >= 0 &&
        h.start < snippet.length &&
        h.end > h.start,
    )
    .map((h) => ({ start: h.start, end: Math.min(h.end, snippet.length) }))
    .sort((a, b) => a.start - b.start)

  const parts: SnippetPart[] = []
  let cursor = 0
  for (const range of ranges) {
    if (range.start < cursor) continue
    if (range.start > cursor) parts.push({ text: snippet.slice(cursor, range.start), match: false })
    parts.push({ text: snippet.slice(range.start, range.end), match: true })
    cursor = range.end
  }
  if (cursor < snippet.length) parts.push({ text: snippet.slice(cursor), match: false })

  return parts
    .map((p) => ({ text: p.text.replace(/\s+/g, ' '), match: p.match }))
    .filter((p) => p.text.length > 0)
}

/**
 * Case-insensitive substring split on the query. Used when the server gave no
 * highlight ranges — an older streamer, or a metadata / `preview` fallback hit.
 */
function splitByNeedle(text: string, needle: string): SnippetPart[] {
  const lower = text.toLowerCase()
  const lowerNeedle = needle.toLowerCase()
  if (!lowerNeedle || !lower.includes(lowerNeedle)) return [{ text, match: false }]

  const parts: SnippetPart[] = []
  let cursor = 0
  while (cursor < text.length) {
    const found = lower.indexOf(lowerNeedle, cursor)
    if (found === -1) {
      parts.push({ text: text.slice(cursor), match: false })
      break
    }
    if (found > cursor) parts.push({ text: text.slice(cursor, found), match: false })
    parts.push({ text: text.slice(found, found + lowerNeedle.length), match: true })
    cursor = found + lowerNeedle.length
  }
  return parts
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1).trimEnd() + '…'
}

export function MessagePreview(props: MessagePreviewProps) {
  const theme = useTheme()
  const styles = makeStyles(theme)

  // Search snippets are already excerpted around the hit and carry their own
  // offsets, so they bypass pickText / truncate entirely and get a second line.
  const needle = props.highlight?.trim()
  const searchMatch = props.mode === 'none' ? null : pickMatch(props.matches, props.rowTitle)
  let snippetParts = searchMatch ? splitSnippet(searchMatch.snippet, searchMatch.highlights) : []
  // Metadata and `preview` fallback hits carry no ranges, and so does any hit
  // from a streamer older than 1.62.0. Emphasise the query itself rather than
  // rendering a snippet that never says why the row matched.
  if (needle && snippetParts.length > 0 && !snippetParts.some((p) => p.match)) {
    snippetParts = splitByNeedle(snippetParts.map((p) => p.text).join(''), needle)
  }
  if (snippetParts.length > 0) {
    return (
      <Text style={styles.preview} numberOfLines={2} testID="search-snippet">
        {snippetParts.map((p, idx) =>
          p.match ? (
            <Text key={idx} style={styles.match}>{p.text}</Text>
          ) : (
            p.text
          ),
        )}
      </Text>
    )
  }

  const text = pickText(props)
  if (!text) return null

  const final = truncate(normalise(text), props.maxChars ?? DEFAULT_MAX)

  // Highlight is optional and used only by search results. The Text node still
  // renders a single visual line; we just split on the matched substring
  // (case-insensitive) and wrap matches in a tinted span.
  if (needle) {
    const parts = splitByNeedle(final, needle)
    if (parts.some((p) => p.match)) {
      return (
        <Text style={styles.preview} numberOfLines={1}>
          {parts.map((p, idx) =>
            p.match ? (
              <Text key={idx} style={styles.match}>{p.text}</Text>
            ) : (
              p.text
            ),
          )}
        </Text>
      )
    }
  }

  return (
    <Text style={styles.preview} numberOfLines={1}>{final}</Text>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    preview: {
      color: theme.text.secondary,
      fontSize: font.xs,
      lineHeight: font.xs + 4,
    },
    match: {
      backgroundColor: `${theme.text.accent}38`,
      color: theme.text.primary,
    },
  })
}
