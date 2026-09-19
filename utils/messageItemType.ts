import type { Message } from '@/types/api'

// A text answer past this length is split into its own type. One 8,000-char
// answer measures ~5,600pt against ~60pt for a one-line reply; sharing an
// average makes FlashList estimate every unmeasured short row as huge, so it
// mounts a row or two per layout commit and React aborts the chain with
// "Maximum update depth exceeded". ~1,200 chars is ~25 lines at phone width.
export const LONG_TEXT_CHARS = 1200

// Item type drives two FlashList v2 mechanisms: the recycling pool AND the
// per-type running-average height used to place rows that haven't been
// measured yet. Real conversations span ~46pt (collapsed Reasoning header)
// to ~3,100pt (markdown-table answers), so lumping every thinking/tool/diff
// row into one pool poisons that average — measured as ±10-20k pt
// content-size swings that shove the mVCP anchor around while scrolling up
// (the blank-gap / viewport-teleport bug). Split by the row's dominant
// shape so each pool's average tracks rows that actually look alike.
export function messageItemType(item: Message): string {
  let hasThinking = false
  let hasTool = false
  let hasDiff = false
  for (const b of item.content) {
    if (b.type === 'thinking') hasThinking = true
    else if (b.type === 'tool_use' || b.type === 'tool_result') hasTool = true
    else if (b.type === 'diff') hasDiff = true
  }
  if (hasDiff) return 'diff'
  if (hasTool) return 'tool'
  if (hasThinking) return 'thinking'
  const textLength = item.content.reduce((n, b) => (b.type === 'text' ? n + b.text.length : n), 0)
  const isLong = textLength > LONG_TEXT_CHARS
  if (item.role === 'user') return isLong ? 'userLong' : 'user'
  return isLong ? 'assistantLong' : 'assistant'
}
