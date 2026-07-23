import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { useTranslation } from 'react-i18next'
import { Highlight, themes, type Language } from 'prism-react-renderer'
import { HighlightText, type MatchLayout } from 'one-more-highlight/native'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'
import type { Message, MessageContent } from '@/types/api'
import { flexRow } from '@/lib/rtl'

interface Props {
  message: Message
  /** Reserved for parity with other cards; MessageBubble no longer caches expanded state. */
  recycleKey?: string
  /** Search keyword to highlight in plain text blocks — never applied to code/tool content. */
  highlight?: string
  /** Set on the anchored search row: reports where the match sits inside the row. */
  matchAnchor?: MatchAnchor
  /** Set when nested inside MessageItem's toolContainer, which already applies its own
   * marginVertical + gap — an outer margin here would double the spacing between rows. */
  noOuterMargin?: boolean
}

export interface MatchAnchor {
  /** The row's outer View — the match's y is measured relative to it. */
  rowRef: React.RefObject<View | null>
  /** Receives the matched line's y offset within the row once text lays out. */
  onLayout: (y: number) => void
}

function decodeEntities(s: string) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function TextContent({
  text,
  isUser,
  highlight,
  matchAnchor,
}: {
  text: string
  isUser?: boolean
  highlight?: string
  matchAnchor?: MatchAnchor
}) {
  const theme = useTheme()
  const styles = makeStyles(theme)
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
        highlightStyle={styles.match}
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



const CODE_THEME = themes.oneDark

function DiffLines({ code }: { code: string }) {
  const theme = useTheme()
  const styles = makeStyles(theme)
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
  const theme = useTheme()
  const styles = makeStyles(theme)
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
  const theme = useTheme()
  const styles = makeStyles(theme)
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
    <View style={styles.codeBlock}>
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

// Map fence tag aliases to Prism grammar names (Prism uses 'js' not 'javascript' etc.).
const LANGUAGE_ALIASES: Record<string, Language> = {
  javascript: 'js',
  typescript: 'tsx',
  ts: 'tsx',
  shell: 'bash',
  sh: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  golang: 'go',
}

// Bare fences (no language tag) get a best-guess from a tiny heuristic. Order
// matters: most specific patterns first, generic fallback last. 'clike' is
// Prism's generic C-family grammar and catches strings/keywords/numbers in
// most curly-brace languages we don't explicitly detect.
function guessLanguage(code: string): Language {
  const head = code.slice(0, 200)
  // bash: a command at start, possibly preceded by `$ ` prompts or `VAR=value` env assignments.
  if (/^\s*(\$\s+)?(\w+=\S+\s+)*(cd|ls|cat|echo|grep|sed|awk|find|git|npm|npx|yarn|pnpm|brew|sudo|curl|wget|mkdir|rm|mv|cp|chmod|chown|export|source|kill|ps|lsof|tail|head|less|more|tree|jq|docker)\b/m.test(head)) return 'bash'
  // diff: standard header forms, OR a mix of '+' AND '-' prefixed lines (so
  // markdown bullet lists with only '-' don't get misclassified).
  if (/^\s*(diff --git|@@|[-+]{3}\s)/m.test(head)) return 'diff'
  const hasPlusLine = /^\+ /m.test(head)
  const hasMinusLine = /^- /m.test(head)
  if (hasPlusLine && hasMinusLine) return 'diff'
  if (/^\s*\{[\s\S]*"[\w-]+"\s*:/m.test(head)) return 'json'
  if (/^\s*<\?xml|^\s*<!DOCTYPE|^\s*<[a-zA-Z]+[\s>]/m.test(head)) return 'markup'
  if (/^\s*(import\s.+\sfrom\s|export\s+(default\s+)?(function|const|class|interface|type)\s|interface\s+\w+|type\s+\w+\s*=)/m.test(head)) return 'tsx'
  if (/=>|const\s+\w+\s*=|function\s+\w+\s*\(/m.test(head)) return 'tsx'
  if (/^\s*(def|class|import|from)\s+\w+/m.test(head) && /:\s*$/m.test(head)) return 'python'
  if (/^\s*#\s|^\s*\*\s|^\s*\d+\.\s|^\s*```/m.test(head)) return 'markdown'
  return 'clike'
}

function parseLanguage(rawLang: string | undefined, code: string): Language {
  if (!rawLang) return guessLanguage(code)
  const normalized = rawLang.toLowerCase()
  return LANGUAGE_ALIASES[normalized] ?? (normalized as Language)
}

type ParsedPart =
  | { kind: 'code'; code: string; language: Language }
  | { kind: 'text'; text: string }

function parseTextParts(text: string): ParsedPart[] {
  const decoded = decodeEntities(text)
  const parts = decoded.split(/(```[\s\S]*?```)/g)
  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const inner = part.slice(3, -3)
      const langMatch = inner.match(/^(\w+)\n/)
      const rawCode = langMatch ? inner.slice(langMatch[0].length) : inner
      // Strip the leading/trailing newlines that fence syntax introduces;
      // preserve any blank lines that are part of the actual code body.
      const code = rawCode.replace(/^\n+/, '').replace(/\n+$/, '')
      const language = parseLanguage(langMatch?.[1], code)
      return { kind: 'code' as const, code, language }
    }
    // Trim a single newline on each side that touches a fenced sibling so
    // the visual gap around CodeBlocks doesn't double up with the fence
    // syntax's own newlines. Blank lines elsewhere in the prose are kept.
    const prevIsFence = i > 0 && parts[i - 1].startsWith('```') && parts[i - 1].endsWith('```')
    const nextIsFence = i < parts.length - 1 && parts[i + 1].startsWith('```') && parts[i + 1].endsWith('```')
    let body = part
    if (prevIsFence) body = body.replace(/^\n/, '')
    if (nextIsFence) body = body.replace(/\n$/, '')
    return { kind: 'text' as const, text: body }
  })
}

function TextBlockBody({
  text,
  isUser,
  highlight,
  matchAnchor,
}: {
  text: string
  isUser?: boolean
  highlight?: string
  matchAnchor?: MatchAnchor
}) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  // The fence split + per-block parse runs on every render otherwise —
  // memoized so re-renders of the bubble don't redo string work.
  const parts = useMemo(() => parseTextParts(text), [text])

  return (
    <View style={styles.gap}>
      {parts.map((part, i) =>
        part.kind === 'code' ? (
          <CodeBlock key={i} code={part.code} language={part.language} />
        ) : (
          <TextContent key={i} text={part.text} isUser={isUser} highlight={highlight} matchAnchor={matchAnchor} />
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
}: {
  block: MessageContent
  isUser?: boolean
  highlight?: string
  matchAnchor?: MatchAnchor
}) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  if (block.type === 'text') {
    return <TextBlockBody text={block.text} isUser={isUser} highlight={highlight} matchAnchor={matchAnchor} />
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
export const MessageBubble = React.memo(function MessageBubble({ message, highlight, matchAnchor, noOuterMargin }: Props) {
  const { t } = useTranslation('conversation')
  const theme = useTheme()
  const isGlass = useIsGlass()
  const styles = makeStyles(theme)
  const isUser = message.role === 'user'

  return (
    <View style={[styles.container, noOuterMargin && styles.containerNoMargin, isUser ? styles.containerUser : styles.containerAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant, !isUser && isGlass && styles.bubbleAssistantGlass]}>
        {!isUser && <GlassFill />}
        {message.content.map((block, i) => (
          <ContentBlock key={i} block={block} isUser={isUser} highlight={highlight} matchAnchor={matchAnchor} />
        ))}
        {message.tokens ? (
          <Text style={styles.tokens}>{t('message.tokens', { count: message.tokens })}</Text>
        ) : null}
      </View>
    </View>
  )
})

function makeStyles(theme: Theme) {
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
      borderBottomRightRadius: radius.sm,
    },
    bubbleAssistant: {
      backgroundColor: theme.bg.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderBottomLeftRadius: radius.sm,
    },
    bubbleAssistantGlass: {
      backgroundColor: 'transparent',
    },
    messageText: {
      color: theme.text.primary,
      fontSize: font.base,
      lineHeight: 22,
    },
    // Solid high-contrast highlighter fill, identical in every bubble type —
    // a dedicated per-theme token so it pops on both the assistant card bg and
    // the accent-colored user bubble.
    match: {
      backgroundColor: theme.text.highlight,
      color: theme.text.onHighlight,
      borderRadius: 3,
    },
    codeBlock: {
      backgroundColor: theme.bg.primary,
      borderRadius: radius.sm,
      overflow: 'hidden',
      marginVertical: spacing.xs,
    },
    codeHeader: {
      flexDirection: flexRow(),
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
      flexDirection: flexRow(),
      flexWrap: 'wrap',
    },
    codeToken: {
      fontFamily: 'monospace',
      fontSize: font.sm,
      fontWeight: '600',
      color: theme.text.primary,
    },
    diffAdd: {
      backgroundColor: 'rgba(46, 160, 67, 0.18)',
    },
    diffDel: {
      backgroundColor: 'rgba(248, 81, 73, 0.18)',
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
    gap: { gap: spacing.xs },
  })
}
