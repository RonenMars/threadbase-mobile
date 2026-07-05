import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRecyclingState } from '@shopify/flash-list'
import { useTranslation } from 'react-i18next'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'
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
}

export function ToolCard({ block, recycleKey }: Props) {
  const { t } = useTranslation('conversation')
  const theme = useTheme()
  const isGlass = useIsGlass()
  const styles = makeStyles(theme)
  const [expanded, setExpanded] = useRecyclingState(false, [recycleKey])

  const toolName = block.type === 'tool_use' ? block.name : block.toolName
  const icon = TOOL_ICONS[toolName] ?? TOOL_ICONS.default
  const isError = block.type === 'tool_result' && block.isError

  // AskUserQuestion: render a readable summary of the questions + option labels
  // the user was offered, instead of dumping the raw JSON input.
  const askSummary =
    block.type === 'tool_use' && block.name === 'AskUserQuestion'
      ? summarizeAskUserQuestion(block.input)
      : null

  const hasContent =
    block.type === 'tool_result'
      ? !!block.content
      : Object.keys(block.input).length > 0

  return (
    <TouchableOpacity
      onPress={() => hasContent && setExpanded((v) => !v)}
      style={[styles.card, isError && styles.cardError, isGlass && styles.cardGlass]}
      accessibilityLabel={`${toolName} tool ${expanded ? 'collapse' : 'expand'}`}
      accessibilityRole="button"
    >
      <GlassFill />
      <View style={styles.header}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.name}>{toolName}</Text>
        {isError ? <Text style={styles.errorBadge}>{t('message.errorBadge')}</Text> : null}
        {hasContent ? (
          <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
        ) : null}
      </View>

      {expanded && hasContent ? (
        <View style={styles.body}>
          {askSummary ? (
            <Text style={styles.code} selectable>
              {askSummary}
            </Text>
          ) : block.type === 'tool_use' ? (
            <Text style={styles.code} selectable>
              {JSON.stringify(block.input, null, 2)}
            </Text>
          ) : (
            <Text style={[styles.code, isError && styles.errorText]} selectable>
              {block.content}
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
    errorText: {
      color: theme.status.failed,
    },
  })
}
