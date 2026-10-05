import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'
import type { Message, MessageContent } from '@/types/api'
import { useThemedStyles } from '@/hooks/useThemedStyles'
import { parseMarkdownFor } from '@/lib/markdown'
import { ChatMarkdown } from '@/components/conversation/ChatMarkdown'
import type { RtlStyleKit } from '@/lib/rtl'
import type { MatchAnchor } from '@/components/conversation/matchAnchor'

export type { MatchAnchor } from '@/components/conversation/matchAnchor'

function useBubbleStyles() {
  return useThemedStyles(makeStyles)
}

interface Props {
  message: Message
  /** Reserved for parity with other cards; MessageBubble no longer caches expanded state. */
  recycleKey?: string
  /** Search keyword to highlight in plain text blocks — never applied to code/tool content. */
  highlight?: string
  /** Set on the anchored search row: reports where the match sits inside the row. */
  matchAnchor?: MatchAnchor
  /** This row is the active match — solid highlighter fill instead of the wash. */
  activeMatch?: boolean
  /** Set when nested inside MessageItem's toolContainer, which already applies its own
   * marginVertical + gap — an outer margin here would double the spacing between rows. */
  noOuterMargin?: boolean
}

function TextBlockBody({
  block,
  text,
  isUser,
  highlight,
  matchAnchor,
  activeMatch,
}: {
  /** The content block this text came from — the parse cache's key. */
  block: object
  text: string
  isUser?: boolean
  highlight?: string
  matchAnchor?: MatchAnchor
  activeMatch?: boolean
}) {
  // Memoised on the content block rather than in a `useMemo`, so a recycled
  // FlashList cell re-bound to another row does not re-parse text it has
  // already seen. See `parseMarkdownFor`.
  const blocks = parseMarkdownFor(block, text)
  return (
    <ChatMarkdown
      blocks={blocks}
      isUser={isUser}
      highlight={highlight?.trim() || undefined}
      matchAnchor={matchAnchor}
      activeMatch={activeMatch}
    />
  )
}

function ContentBlock({
  block,
  isUser,
  highlight,
  matchAnchor,
  activeMatch,
}: {
  block: MessageContent
  isUser?: boolean
  highlight?: string
  matchAnchor?: MatchAnchor
  activeMatch?: boolean
}) {
  const { styles } = useBubbleStyles()
  if (block.type === 'text') {
    return (
      <TextBlockBody
        block={block}
        text={block.text}
        isUser={isUser}
        highlight={highlight}
        matchAnchor={matchAnchor}
        activeMatch={activeMatch}
      />
    )
  }
  if (block.type === 'tool_use') {
    return (
      <View style={styles.toolTag}>
        <Text style={styles.toolTagText}>🔧 {block.name}</Text>
      </View>
    )
  }
  return null
}

// Memoized: message objects are stable by reference for already-loaded pages
// (adaptRawMessage output is reused between renders), so screen-level state
// changes don't re-render — and re-highlight — every visible row.
export const MessageBubble = React.memo(function MessageBubble({ message, highlight, matchAnchor, activeMatch, noOuterMargin }: Props) {
  const { t } = useTranslation('conversation')
  const { styles } = useBubbleStyles()
  const isGlass = useIsGlass()
  const isUser = message.role === 'user'

  return (
    <View style={[styles.container, noOuterMargin && styles.containerNoMargin, isUser ? styles.containerUser : styles.containerAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant, !isUser && isGlass && styles.bubbleAssistantGlass]}>
        {!isUser && <GlassFill />}
        {message.content.map((block, i) => (
          <ContentBlock
            key={i}
            block={block}
            isUser={isUser}
            highlight={highlight}
            matchAnchor={matchAnchor}
            activeMatch={activeMatch}
          />
        ))}
        {message.tokens ? (
          <Text style={styles.tokens}>{t('message.tokens', { count: message.tokens })}</Text>
        ) : null}
      </View>
    </View>
  )
})

function makeStyles(theme: Theme, rtl: RtlStyleKit) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: spacing.md,
      marginVertical: spacing.xs,
    },
    containerNoMargin: { marginVertical: 0 },
    containerUser: { alignItems: 'flex-end' },
    containerAssistant: { alignItems: 'flex-start' },
    bubble: {
      maxWidth: '85%',
      alignSelf: 'flex-start',
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.xs,
      overflow: 'hidden',
    },
    bubbleUser: {
      alignSelf: 'flex-end',
      backgroundColor: theme.text.accent,
      borderBottomEndRadius: radius.sm,
    },
    bubbleAssistant: {
      backgroundColor: theme.bg.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderBottomStartRadius: radius.sm,
    },
    bubbleAssistantGlass: {
      backgroundColor: 'transparent',
    },
    toolTag: {
      backgroundColor: `${theme.text.accent}20`,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    toolTagText: {
      color: theme.text.accent,
      fontSize: font.xs,
    },
    tokens: {
      color: theme.text.secondary,
      fontSize: font.xs,
      marginTop: spacing.xs,
      alignSelf: 'flex-end',
    },
  })
}
