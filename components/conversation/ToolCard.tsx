import React, { useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRecyclingState } from '@shopify/flash-list'
import { HighlightText, type MatchLayout } from 'one-more-highlight/native'
import { useTranslation } from 'react-i18next'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'
import type { MatchAnchor } from '@/components/conversation/MessageBubble'
import type { MessageContent } from '@/types/api'

const TOOL_ICONS: Record<string, string> = {
  Edit: '✏️',
  Bash: '💻',
  Read: '👁',
  Write: '🖊',
  Glob: '🔍',
  Grep: '🔎',
  default: '🔧',
}

type ToolUse = Extract<MessageContent, { type: 'tool_use' }>
type ToolResult = Extract<MessageContent, { type: 'tool_result' }>

interface RawAskQuestion {
  question?: unknown
  header?: unknown
  options?: unknown
}

// Render an AskUserQuestion tool input as a readable summary: each question's
// header/question followed by its option labels as a bulleted list. Returns null
// when the input has no recognisable questions (caller falls back to JSON).
function summarizeAskUserQuestion(input: Record<string, unknown>): string | null {
  const questions = input.questions
  if (!Array.isArray(questions)) return null
  const blocks: string[] = []
  for (const q of questions as RawAskQuestion[]) {
    if (!q || typeof q !== 'object') continue
    const header = typeof q.header === 'string' ? q.header.trim() : ''
    const question = typeof q.question === 'string' ? q.question.trim() : ''
    if (!question) continue
    const lines: string[] = []
    lines.push(header ? `${header}: ${question}` : question)
    if (Array.isArray(q.options)) {
      for (const o of q.options) {
        if (o && typeof o === 'object' && typeof (o as { label?: unknown }).label === 'string') {
          lines.push(`  • ${(o as { label: string }).label}`)
        }
      }
    }
    blocks.push(lines.join('\n'))
  }
  return blocks.length > 0 ? blocks.join('\n\n') : null
}

interface Props {
  block: ToolUse | ToolResult
  /** Stable per-cell key — reset recycled `expanded` state when the cell is reassigned. */
  recycleKey?: string
  /** Search keyword, set on every row while a search is active. Tinted wherever the
   * card is already open; only the active row force-opens a collapsed one. */
  highlight?: string
  /** Reports the highlighted match's y within the row, for anchored scrolling. */
  matchAnchor?: MatchAnchor
  /** This row is the active match — force the card open and use the solid fill. */
  activeMatch?: boolean
}

export function ToolCard({ block, recycleKey, highlight, matchAnchor, activeMatch }: Props) {
  const { t } = useTranslation('conversation')
  const theme = useTheme()
  const isGlass = useIsGlass()
  const styles = makeStyles(theme)
  const [expanded, setExpanded] = useRecyclingState(false, [recycleKey])
  const bodyRef = useRef<Text>(null)

  const toolName = block.type === 'tool_use' ? block.name : block.toolName
  const icon = TOOL_ICONS[toolName] ?? TOOL_ICONS.default
  const isError = block.type === 'tool_result' && block.isError

  // AskUserQuestion: render a readable summary of the questions + option labels
  // the user was offered, instead of dumping the raw JSON input.
  const askSummary =
    block.type === 'tool_use' && block.name === 'AskUserQuestion'
      ? summarizeAskUserQuestion(block.input)
      : null

  const bodyText =
    askSummary ??
    (block.type === 'tool_use' ? JSON.stringify(block.input, null, 2) : block.content)

  const hasContent =
    block.type === 'tool_result'
      ? !!block.content
      : Object.keys(block.input).length > 0

  // The search backend counts tool payloads as matches, so a message can be
  // the anchor purely because its keyword sits in this collapsed body. Open it
  // (overriding the recycled collapsed state) so the highlighted match shows.
  // Only for the ACTIVE row: force-opening every card whose payload mentions
  // the query would unfold most of the conversation on a common word.
  const needle = highlight?.trim()
  const matchesBody = !!needle && bodyText.toLowerCase().includes(needle.toLowerCase())
  const isOpen = expanded || (matchesBody && !!activeMatch)

  // Once the body lays out (which only happens after the match force-opens it),
  // report the keyword's y within the row so the screen can aim the anchor
  // scroll at it — same pattern as MessageBubble's TextContent.
  const reportMatchLayout = matchAnchor
    ? (matches: readonly MatchLayout[]) => {
        const first = matches[0]
        const row = matchAnchor.rowRef.current
        if (!first || !row || !bodyRef.current) return
        bodyRef.current.measureLayout(row, (_x, y) => matchAnchor.onLayout(y + first.y))
      }
    : undefined

  return (
    <TouchableOpacity
      onPress={() => hasContent && setExpanded((v) => !v)}
      style={[styles.card, isError && styles.cardError, isGlass && styles.cardGlass]}
      accessibilityLabel={`${toolName} tool ${isOpen ? 'collapse' : 'expand'}`}
      accessibilityRole="button"
    >
      <GlassFill />
      <View style={styles.header}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.name}>{toolName}</Text>
        {isError ? <Text style={styles.errorBadge}>{t('message.errorBadge')}</Text> : null}
        {hasContent ? (
          <Text style={styles.chevron}>{isOpen ? '▲' : '▼'}</Text>
        ) : null}
      </View>

      {isOpen && hasContent ? (
        <View style={styles.body}>
          {matchesBody ? (
            <HighlightText
              ref={bodyRef}
              text={bodyText}
              searchWords={[needle]}
              highlightStyle={activeMatch ? styles.match : styles.matchInactive}
              style={[styles.code, isError && styles.errorText]}
              textProps={{ selectable: true }}
              onMatchesLayout={reportMatchLayout}
            />
          ) : (
            <Text style={[styles.code, isError && styles.errorText]} selectable>
              {bodyText}
            </Text>
          )}
        </View>
      ) : null}
    </TouchableOpacity>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.bg.secondary,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    cardGlass: {
      backgroundColor: 'transparent',
    },
    cardError: {
      borderColor: theme.status.failed,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      padding: spacing.sm,
      minHeight: 44,
    },
    icon: { fontSize: font.sm },
    name: {
      color: theme.text.secondary,
      fontSize: font.sm,
      flex: 1,
    },
    errorBadge: {
      color: theme.status.failed,
      fontSize: font.xs,
      fontWeight: '600',
    },
    chevron: {
      color: theme.text.secondary,
      fontSize: font.xs,
    },
    body: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      padding: spacing.sm,
    },
    code: {
      color: theme.text.primary,
      fontFamily: 'monospace',
      fontSize: font.xs,
    },
    // Solid high-contrast highlighter fill — shared per-theme token.
    match: {
      backgroundColor: theme.text.highlight,
      color: theme.text.onHighlight,
      borderRadius: 3,
    },
    // Matches on non-active rows get a wash, so the active one stays findable.
    matchInactive: {
      backgroundColor: `${theme.text.highlight}59`,
      borderRadius: 3,
    },
    errorText: {
      color: theme.status.failed,
    },
  })
}
