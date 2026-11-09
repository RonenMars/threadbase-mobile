import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native'
import Markdown from 'react-native-markdown-display'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { useTranslation } from 'react-i18next'
import { Wrench } from 'phosphor-react-native'
import { Highlight, themes, type Language } from 'prism-react-renderer'
import { HighlightText, type MatchLayout } from 'one-more-highlight/native'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'
import type { Message, MessageContent } from '@/types/api'
import { useThemedStyles } from '@/hooks/useThemedStyles'
import { isOpenableLinkUrl } from '@/lib/isOpenableLinkUrl'
import { splitFences } from '@/lib/markdown'
import { layoutDirectionStyle, type RtlStyleKit } from '@/lib/rtl'

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
  /** Sent mid-turn and not yet picked up by the agent: dimmed and labelled. */
  queued?: boolean
}

export interface MatchAnchor {
  /** The row's outer View — the match's y is measured relative to it. */
  rowRef: React.RefObject<View | null>
  /** Receives the matched line's y offset within the row once text lays out. */
  onLayout: (y: number) => void
}

function TextContent({
  text,
  isUser,
  highlight,
  matchAnchor,
  activeMatch,
}: {
  text: string
  isUser?: boolean
  highlight?: string
  matchAnchor?: MatchAnchor
  activeMatch?: boolean
}) {
  const { styles, theme } = useBubbleStyles()
  const textRef = useRef<Text>(null)
  const textStyle = [styles.messageText, isUser && { color: theme.text.onAccent }]
  const needle = highlight?.trim()
  if (needle) {
    // The library reports the first match's line-y within the root Text; add
    // the Text's own offset within the row to get the match's y inside the
    // row, which the conversation screen uses to aim the anchor scroll at the
    // keyword itself.
    const reportMatchLayout = matchAnchor
      ? (matches: readonly MatchLayout[]) => {
          const first = matches[0]
          const row = matchAnchor.rowRef.current
          if (!first || !row || !textRef.current) return
          textRef.current.measureLayout(row, (_x, y) => matchAnchor.onLayout(y + first.y))
        }
      : undefined
    return (
      <HighlightText
        ref={textRef}
        text={text}
        searchWords={[needle]}
        highlightStyle={activeMatch ? styles.match : styles.matchInactive}
        style={textStyle}
        textProps={{ selectable: true }}
        onMatchesLayout={reportMatchLayout}
      />
    )
  }
  return (
    <Text style={textStyle} selectable>
      {text}
    </Text>
  )
}



// oneDark's saturated magenta/cyan tokens are tuned for a full editor pane;
// in a narrow chat bubble with tight padding they read as neon. vsDark (VS
// Code Dark+) carries the same intent at lower saturation — the same
// reference point GitHub/Slack/Discord code blocks use.
const CODE_THEME = themes.vsDark

function DiffLines({ code }: { code: string }) {
  const { styles } = useBubbleStyles()
  const lines = code.split('\n')
  return (
    <>
      {lines.map((line, i) => {
        const isAdd = line.startsWith('+')
        const isDel = line.startsWith('-')
        const lineStyle = isAdd ? styles.diffAdd : isDel ? styles.diffDel : undefined
        return (
          <View key={i} style={[styles.codeLine, lineStyle]}>
            <Text style={styles.codeToken} selectable>{line.length === 0 ? ' ' : line}</Text>
          </View>
        )
      })}
    </>
  )
}

// Prism tokenization runs synchronously on the JS thread and a large block
// costs tens of ms — memoized so CodeBlock-local state changes (the copied
// flag) and parent re-renders don't re-tokenize the same code.
const HighlightedCode = React.memo(function HighlightedCode({ code, language }: { code: string; language: Language }) {
  const { styles } = useBubbleStyles()
  return (
    <View style={[styles.codeBody, { backgroundColor: CODE_THEME.plain.backgroundColor }]}>
      {language === 'diff' ? (
        <DiffLines code={code} />
      ) : (
        <Highlight code={code} language={language} theme={CODE_THEME}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <>
              {tokens.map((line, lineIdx) => {
                const { style: lineStyle } = getLineProps({ line })
                return (
                  <View key={lineIdx} style={[styles.codeLine, lineStyle as object]}>
                    {line.map((token, tokenIdx) => {
                      const { style: tokenStyle, children } = getTokenProps({ token })
                      return (
                        <Text
                          key={tokenIdx}
                          style={[styles.codeToken, tokenStyle as object]}
                          selectable
                        >
                          {children}
                        </Text>
                      )
                    })}
                  </View>
                )
              })}
            </>
          )}
        </Highlight>
      )}
    </View>
  )
})

function CodeBlock({ code, language }: { code: string; language: Language }) {
  const { t } = useTranslation('conversation')
  const { styles } = useBubbleStyles()
  const [copied, setCopied] = useState(false)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
  }, [])
  const copy = async () => {
    await Clipboard.setStringAsync(code)
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setCopied(true)
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <View style={styles.codeBlock} testID="message-code-block">
      <View style={styles.codeHeader}>
        <Text style={styles.codeHeaderText}>{t('message.code')}</Text>
        <TouchableOpacity onPress={copy} style={styles.codeCopyBtn}>
          <Text style={styles.codeCopyText}>
            {copied ? t('action.copiedCode') : t('action.copyCode')}
          </Text>
        </TouchableOpacity>
      </View>
      <HighlightedCode code={code} language={language} />
    </View>
  )
}

function makeMarkdownStyles(theme: Theme) {
  return {
    // Base text props cascade to all leaf text nodes via inheritedStyles
    body: {
      color: theme.text.primary,
      fontSize: font.base,
      lineHeight: 22,
    },
    // Tighten the default 10/10 top+bottom margins so paragraphs sit compactly
    // inside the bubble rather than adding double spacing around code blocks.
    paragraph: {
      marginTop: 0,
      marginBottom: spacing.xs,
    },
    heading1: { color: theme.text.primary, fontSize: font.xxl, fontWeight: '700' as const, marginBottom: spacing.xs },
    heading2: { color: theme.text.primary, fontSize: font.xl,  fontWeight: '700' as const, marginBottom: spacing.xs },
    heading3: { color: theme.text.primary, fontSize: font.lg,  fontWeight: '700' as const, marginBottom: spacing.xs },
    heading4: { color: theme.text.primary, fontSize: font.base, fontWeight: '700' as const },
    heading5: { color: theme.text.secondary, fontSize: font.sm, fontWeight: '700' as const },
    heading6: { color: theme.text.secondary, fontSize: font.sm },
    strong: { fontWeight: '700' as const },
    em: { fontStyle: 'italic' as const },
    s: { textDecorationLine: 'line-through' as const },
    code_inline: {
      fontFamily: 'monospace',
      fontSize: font.sm,
      backgroundColor: `${theme.text.accent}22`,
      color: theme.text.accent,
      borderRadius: 3,
    },
    link: { color: theme.text.accent, textDecorationLine: 'underline' as const },
    blockquote: {
      borderStartWidth: 3,
      borderStartColor: theme.text.secondary,
      paddingStart: spacing.sm,
      marginStart: 0,
      color: theme.text.secondary,
    },
    bullet_list: { marginStart: spacing.sm },
    ordered_list: { marginStart: spacing.sm },
    // The library default is flex: 1 (basis 0), which adds nothing to a
    // shrink-wrapped bubble's width — a reply that is only a list collapses
    // to one character per line. flexShrink sizes to the text, capped by maxWidth.
    bullet_list_content: { flex: undefined, flexGrow: 0, flexShrink: 1, flexBasis: 'auto' as const },
    ordered_list_content: { flex: undefined, flexGrow: 0, flexShrink: 1, flexBasis: 'auto' as const },
    hr: { backgroundColor: theme.border, height: 1, marginVertical: spacing.xs },
  }
}

// Splits a markdown text node's plain content around a search needle so a
// highlighted span can render inline in a Text run — rendering markdown via
// <Markdown> and highlighting via a separate plain-text pass are mutually
// exclusive, so highlighting is done as a rule override on the same tree
// instead, keeping links/emphasis/etc. intact while searching.
function renderHighlightedRun(content: string, needle: string, style: object) {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = content.split(new RegExp(`(${escaped})`, 'ig'))
  return parts.map((part, i) =>
    part.toLowerCase() === needle.toLowerCase() ? (
      <Text key={i} style={style}>{part}</Text>
    ) : (
      part
    ),
  )
}

function MarkdownProse({ text, highlight, activeMatch }: { text: string; highlight?: string; activeMatch?: boolean }) {
  const { styles, theme } = useBubbleStyles()
  const mdStyle = useMemo(() => makeMarkdownStyles(theme), [theme])
  const onLinkPress = useCallback((url: string) => {
    if (isOpenableLinkUrl(url)) void Linking.openURL(url)
    return false
  }, [])
  const needle = highlight?.trim()
  const markStyle = activeMatch ? styles.match : styles.matchInactive
  const rules = useMemo(
    () =>
      needle
        ? {
            text: (node: { key: string; content: string }, _children: unknown, _parent: unknown, mdStyles: { text?: object }, inherited: object = {}) => (
              <Text key={node.key} style={[inherited, mdStyles.text]}>
                {renderHighlightedRun(node.content, needle, markStyle)}
              </Text>
            ),
          }
        : undefined,
    [needle, markStyle],
  )
  return (
    <Markdown style={mdStyle} onLinkPress={onLinkPress} mergeStyle rules={rules}>
      {text}
    </Markdown>
  )
}

function TextBlockBody({
  text,
  isUser,
  highlight,
  matchAnchor,
  activeMatch,
}: {
  text: string
  isUser?: boolean
  highlight?: string
  matchAnchor?: MatchAnchor
  activeMatch?: boolean
}) {
  const { styles } = useBubbleStyles()
  // The fence split + per-block parse runs on every render otherwise —
  // memoized so re-renders of the bubble don't redo string work.
  const parts = useMemo(() => splitFences(text), [text])

  return (
    <View style={styles.gap}>
      {parts.map((part, i) =>
        part.kind === 'code' ? (
          <CodeBlock key={i} code={part.code} language={part.language} />
        ) : !isUser ? (
          <MarkdownProse key={i} text={part.text} highlight={highlight} activeMatch={activeMatch} />
        ) : (
          <TextContent
            key={i}
            text={part.text}
            isUser={isUser}
            highlight={highlight}
            matchAnchor={matchAnchor}
            activeMatch={activeMatch}
          />
        ),
      )}
    </View>
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
  const { styles, theme } = useBubbleStyles()
  if (block.type === 'text') {
    return (
      <TextBlockBody
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
        <Wrench size={font.xs} color={theme.text.accent} weight="bold" />
        <Text style={styles.toolTagText}>{block.name}</Text>
      </View>
    )
  }
  return null
}

// Memoized: message objects are stable by reference for already-loaded pages
// (adaptRawMessage output is reused between renders), so screen-level state
// changes don't re-render — and re-highlight — every visible row.
export const MessageBubble = React.memo(function MessageBubble({ message, highlight, matchAnchor, activeMatch, noOuterMargin, queued }: Props) {
  const { t } = useTranslation('conversation')
  const { styles } = useBubbleStyles()
  const isGlass = useIsGlass()
  const isUser = message.role === 'user'

  return (
    <View style={[styles.container, noOuterMargin && styles.containerNoMargin, isUser ? styles.containerUser : styles.containerAssistant]}>
      <View
        testID="message-bubble"
        style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant, !isUser && isGlass && styles.bubbleAssistantGlass, queued && styles.bubbleQueued]}
      >
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
      {queued ? <Text style={styles.queuedLabel}>{t('message.queued')}</Text> : null}
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
    bubbleQueued: { opacity: 0.55 },
    queuedLabel: {
      color: theme.text.secondary,
      fontSize: font.xs,
      marginTop: spacing.xs,
      ...rtl.copy,
    },
    messageText: {
      color: theme.text.primary,
      fontSize: font.base,
      lineHeight: 22,
      ...rtl.copy,
    },
    // Solid high-contrast highlighter fill, identical in every bubble type —
    // a dedicated per-theme token so it pops on both the assistant card bg and
    // the accent-colored user bubble.
    match: {
      backgroundColor: theme.text.highlight,
      color: theme.text.onHighlight,
      borderRadius: 3,
    },
    // Every other match in view gets a wash rather than the solid fill, so the
    // active one stays findable — the browser find-bar convention.
    matchInactive: {
      backgroundColor: `${theme.text.highlight}59`,
      borderRadius: 3,
    },
    codeBlock: {
      ...layoutDirectionStyle('ltr'),
      backgroundColor: theme.bg.primary,
      borderRadius: radius.sm,
      overflow: 'hidden',
      marginVertical: spacing.xs,
    },
    codeHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      backgroundColor: '#1c2128',
    },
    codeHeaderText: {
      color: theme.text.secondary,
      fontSize: font.xs,
    },
    codeCopyBtn: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
    },
    codeCopyText: {
      color: theme.text.accent,
      fontSize: font.xs,
    },
    codeBody: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    codeLine: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    codeToken: {
      fontFamily: 'monospace',
      fontSize: font.sm,
      color: theme.text.primary,
    },
    diffAdd: {
      backgroundColor: 'rgba(46, 160, 67, 0.18)',
    },
    diffDel: {
      backgroundColor: 'rgba(248, 81, 73, 0.18)',
    },
    toolTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
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
    gap: { gap: spacing.xs },
  })
}
