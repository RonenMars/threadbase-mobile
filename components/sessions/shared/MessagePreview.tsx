import { Text, StyleSheet } from 'react-native'
import { dark, font } from '@/constants/theme'

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

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1).trimEnd() + '…'
}

export function MessagePreview(props: MessagePreviewProps) {
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

const styles = StyleSheet.create({
  preview: {
    color: dark.text.secondary,
    fontSize: font.xs,
    lineHeight: font.xs + 4,
  },
  match: {
    backgroundColor: `${dark.text.accent}38`,
    color: dark.text.primary,
  },
})
