import type { Message } from '@/types/api'

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
  return item.role === 'user' ? 'user' : 'assistant'
}
