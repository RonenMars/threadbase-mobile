import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { MessageBubble } from '@/components/conversation/MessageBubble'
import { ThinkingCard } from '@/components/conversation/ThinkingCard'
import { ToolCard } from '@/components/conversation/ToolCard'
import { DiffViewer } from '@/components/conversation/DiffViewer'
import type { Message, MessageContent } from '@/types/api'
import { useTheme } from '@/contexts/ThemeContext'
import { font, spacing, type Theme } from '@/constants/theme'

export function renderContent(block: MessageContent, index: number, recycleKey: string) {
  if (block.type === 'thinking') {
    return <ThinkingCard key={index} block={block} recycleKey={recycleKey} />
  }
  if (block.type === 'tool_use' || block.type === 'tool_result') {
    return <ToolCard key={index} block={block} recycleKey={recycleKey} />
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
export const MessageItem = React.memo(function MessageItem({ message, isLast }: { message: Message; isLast?: boolean }) {
  const { t } = useTranslation('conversation')
  const theme = useTheme()
  const styles = makeStyles(theme)
  const hasToolOrDiff = message.content.some(
    (b) => b.type === 'thinking' || b.type === 'tool_use' || b.type === 'tool_result' || b.type === 'diff'
  )
  // Bug 6 e2e: tag the final row so the Maestro flow can assert the last
  // message lands above (not behind) the Export + Resume action bar.
  const lastTestId = isLast ? 'conversation-last-message' : undefined

  if (hasToolOrDiff) {
    return (
      <View style={styles.toolContainer} testID={lastTestId}>
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
              />
            )
          }
          return renderContent(block, i, message.id)
        })}
      </View>
    )
  }

  if (message.content.length === 0) return null
  return (
    <View testID={lastTestId}>
      {message.has_images ? (
        <Text style={styles.imageBadge}>{t('header.containsImage')}</Text>
      ) : null}
      <MessageBubble message={message} recycleKey={message.id} />
    </View>
  )
})

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    toolContainer: { paddingHorizontal: spacing.md, gap: spacing.xs, marginVertical: spacing.xs },
    imageBadge: { color: theme.text.secondary, fontSize: font.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  })
}
