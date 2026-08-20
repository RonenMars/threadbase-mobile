import React, { useRef } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { MessageBubble, type MatchAnchor } from '@/components/conversation/MessageBubble'
import { ThinkingCard } from '@/components/conversation/ThinkingCard'
import { ToolCard } from '@/components/conversation/ToolCard'
import { DiffViewer } from '@/components/conversation/DiffViewer'
import type { Message, MessageContent } from '@/types/api'
import { useTheme } from '@/contexts/ThemeContext'
import { font, spacing, type Theme } from '@/constants/theme'
import { useReducedMotion } from '@/hooks/useReducedMotion'

export function renderContent(
  block: MessageContent,
  index: number,
  recycleKey: string,
  highlight?: string,
  matchAnchor?: MatchAnchor,
  activeMatch?: boolean,
) {
  if (block.type === 'thinking') {
    return <ThinkingCard key={index} block={block} recycleKey={recycleKey} />
  }
  if (block.type === 'tool_use' || block.type === 'tool_result') {
    return (
      <ToolCard
        key={index}
        block={block}
        recycleKey={recycleKey}
        highlight={highlight}
        matchAnchor={matchAnchor}
        activeMatch={activeMatch}
      />
    )
  }
  if (block.type === 'diff') {
    return <DiffViewer key={index} filename={block.filename} hunks={block.hunks} recycleKey={recycleKey} />
  }
  return null
}

// FlashList recycles cell instances, which would otherwise carry useState
// across messages (ToolCard / ThinkingCard / DiffViewer / MessageBubble each
// own `expanded` state). Threading the message id as `recycleKey` lets each
// child use `useRecyclingState` to reset its state when the cell is reassigned.
// Memoized so screen re-renders during the initial settle don't re-render
// (and re-highlight) every visible row.
export const MessageItem = React.memo(function MessageItem({
  message,
  isLast,
  highlight,
  isActiveMatch,
  onMatchLayout,
  animateIn,
}: {
  message: Message
  isLast?: boolean
  /** Search keyword to tint. Set on every row while a search is active, not just the anchor. */
  highlight?: string
  /**
   * This row holds the active match. Drives the stronger tint, the anchor
   * test id, the layout report that aims the scroll, and the tool-card
   * force-open — none of which may fire on the other matching rows.
   */
  isActiveMatch?: boolean
  /** Reports the highlighted match's y offset within this row, for anchored scrolling. */
  onMatchLayout?: (messageIndex: number, y: number) => void
  /** Play the fade-in-from-bottom entrance — set only on freshly-arrived tail rows. */
  animateIn?: boolean
}) {
  const { t } = useTranslation('conversation')
  const theme = useTheme()
  const styles = makeStyles(theme)
  const reduceMotion = useReducedMotion()
  const rowRef = useRef<View>(null)
  const messageIndex = message.messageIndex
  const matchAnchor: MatchAnchor | undefined =
    isActiveMatch && onMatchLayout && messageIndex != null
      ? { rowRef, onLayout: (y: number) => onMatchLayout(messageIndex, y) }
      : undefined
  const hasToolOrDiff = message.content.some(
    (b) => b.type === 'thinking' || b.type === 'tool_use' || b.type === 'tool_result' || b.type === 'diff'
  )
  // Bug 6 e2e: tag the final row so the Maestro flow can assert the last
  // message lands above (not behind) the Export + Resume action bar.
  // search-anchor e2e: tag the active search-match row so a flow can assert
  // the anchor scroll landed on it. The anchor takes priority — a row is
  // never simultaneously the conversation tail and a mid-conversation
  // search anchor in any fixture this app ships.
  const rowTestId = isActiveMatch ? 'search-anchor-message' : isLast ? 'conversation-last-message' : undefined

  // Fade-in-from-bottom on freshly-arrived rows only. FadeInDown keyed on the
  // message id so React runs it once per real message, never on FlashList cell
  // recycle. Plain View elsewhere — history and scrolled-back rows never animate.
  const Row = animateIn && !reduceMotion ? Animated.View : View
  const entering = animateIn && !reduceMotion ? FadeInDown.duration(260).springify().damping(18) : undefined

  if (hasToolOrDiff) {
    return (
      <Row style={styles.toolContainer} testID={rowTestId} ref={rowRef} entering={entering}>
        {message.has_images ? (
          <Text style={styles.imageBadge}>{t('header.containsImage')}</Text>
        ) : null}
        {message.content.map((block, i) => {
          if (block.type === 'text') {
            if (!block.text.trim()) return null
            return (
              <MessageBubble
                key={i}
                message={{ ...message, content: [block] }}
                recycleKey={message.id}
                highlight={highlight}
                matchAnchor={matchAnchor}
                activeMatch={isActiveMatch}
                noOuterMargin
              />
            )
          }
          return renderContent(block, i, message.id, highlight, matchAnchor, isActiveMatch)
        })}
      </Row>
    )
  }

  if (message.content.length === 0) return null
  return (
    <Row testID={rowTestId} ref={rowRef} entering={entering}>
      {message.has_images ? (
        <Text style={styles.imageBadge}>{t('header.containsImage')}</Text>
      ) : null}
      <MessageBubble
        message={message}
        recycleKey={message.id}
        highlight={highlight}
        matchAnchor={matchAnchor}
        activeMatch={isActiveMatch}
      />
    </Row>
  )
})

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    toolContainer: { paddingHorizontal: spacing.md, gap: spacing.xs, marginVertical: spacing.xs },
    imageBadge: { color: theme.text.secondary, fontSize: font.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  })
}
