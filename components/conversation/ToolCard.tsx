import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { dark, font, radius, spacing } from '@/constants/theme'
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
}

export function ToolCard({ block }: Props) {
  const [expanded, setExpanded] = useState(false)

  const toolName = block.type === 'tool_use' ? block.name : block.toolName
  const icon = TOOL_ICONS[toolName] ?? TOOL_ICONS.default
  const isError = block.type === 'tool_result' && block.isError

  return (
    <TouchableOpacity
      onPress={() => setExpanded((v) => !v)}
      style={[styles.card, isError && styles.cardError]}
      accessibilityLabel={`${toolName} tool ${expanded ? 'collapse' : 'expand'}`}
      accessibilityRole="button"
    >
      <View style={styles.header}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.name}>{toolName}</Text>
        {isError ? <Text style={styles.errorBadge}>Error</Text> : null}
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </View>

      {expanded ? (
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: dark.bg.secondary,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: dark.border,
    overflow: 'hidden',
  },
  cardError: {
    borderColor: dark.status.failed,
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
    color: dark.text.secondary,
    fontSize: font.sm,
    flex: 1,
  },
  errorBadge: {
    color: dark.status.failed,
    fontSize: font.xs,
    fontWeight: '600',
  },
  chevron: {
    color: dark.text.secondary,
    fontSize: font.xs,
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: dark.border,
    padding: spacing.sm,
  },
  code: {
    color: dark.text.primary,
    fontFamily: 'monospace',
    fontSize: font.xs,
  },
  errorText: {
    color: dark.status.failed,
  },
})
