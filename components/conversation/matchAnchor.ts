import type React from 'react'
import type { View } from 'react-native'

/**
 * How a row reports where its search match sits, so the conversation screen can
 * aim an anchored scroll at the keyword rather than at the top of the row.
 *
 * Its own module because both `MessageBubble` and `ChatMarkdown` need the type
 * and `MessageBubble` renders `ChatMarkdown` — importing it back from there
 * would be a cycle.
 */
export interface MatchAnchor {
  /** The row's outer View — the match's y is measured relative to it. */
  rowRef: React.RefObject<View | null>
  /** Receives the matched line's y offset within the row once text lays out. */
  onLayout: (y: number) => void
}
