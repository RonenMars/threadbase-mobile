import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRecyclingState } from '@shopify/flash-list'
import { useTranslation } from 'react-i18next'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
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

interface Props {
  block: ToolUse | ToolResult
  /** Stable per-cell key — reset recycled `expanded` state when the cell is reassigned. */
  recycleKey?: string
}

export function ToolCard({ block, recycleKey }: Props) {
  const { t } = useTranslation('conversation')
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [expanded, setExpanded] = useRecyclingState(false, [recycleKey])

  const toolName = block.type === 'tool_use' ? block.name : block.toolName
  const icon = TOOL_ICONS[toolName] ?? TOOL_ICONS.default
  const isError = block.type === 'tool_result' && block.isError

  const hasContent =
    block.type === 'tool_result'
      ? !!block.content
      : Object.keys(block.input).length > 0

  return (
    <TouchableOpacity
      onPress={() => hasContent && setExpanded((v) => !v)}
      style={[styles.card, isError && styles.cardError]}
      accessibilityLabel={`${toolName} tool ${expanded ? 'collapse' : 'expand'}`}
      accessibilityRole="button"
    >
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
          {block.type === 'tool_use' ? (
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
