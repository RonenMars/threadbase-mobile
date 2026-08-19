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

/** Body hits win over metadata hits; position is not relied on. */
export function pickMatch(matches: SearchMatch[] | null | undefined): SearchMatch | null {
  const usable = (matches ?? []).filter((m) => typeof m?.snippet === 'string' && m.snippet.trim().length > 0)
  return usable.find((m) => m.field === 'content') ?? usable[0] ?? null
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

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1).trimEnd() + '…'
}

export function MessagePreview(props: MessagePreviewProps) {
  const theme = useTheme()
  const styles = makeStyles(theme)

  // Search snippets are already excerpted around the hit and carry their own
  // offsets, so they bypass pickText / truncate entirely and get a second line.
  const searchMatch = props.mode === 'none' ? null : pickMatch(props.matches)
  const snippetParts = searchMatch ? splitSnippet(searchMatch.snippet, searchMatch.highlights) : []
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
  const highlight = props.highlight?.trim()

  // Highlight is optional and used only by search results. The Text node still
  // renders a single visual line; we just split on the matched substring
  // (case-insensitive) and wrap matches in a tinted span.
  if (highlight) {
    const lower = final.toLowerCase()
    const needle = highlight.toLowerCase()
    if (lower.includes(needle)) {
      const parts: { text: string; match: boolean }[] = []
      let i = 0
      while (i < final.length) {
        const found = lower.indexOf(needle, i)
        if (found === -1) {
          parts.push({ text: final.slice(i), match: false })
          break
        }
        if (found > i) parts.push({ text: final.slice(i, found), match: false })
        parts.push({ text: final.slice(found, found + needle.length), match: true })
        i = found + needle.length
      }
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
