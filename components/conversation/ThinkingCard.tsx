import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { dark, font, radius, spacing } from '@/constants/theme'
import type { MessageContent } from '@/types/api'

type ThinkingBlock = Extract<MessageContent, { type: 'thinking' }>

interface Props {
  block: ThinkingBlock
}

export function ThinkingCard({ block }: Props) {
  const [expanded, setExpanded] = useState(false)
  const isRedacted = !block.thinking && !!block.signature

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded((v) => !v)}
        accessibilityLabel={expanded ? 'Collapse reasoning' : 'Expand reasoning'}
      >
        <Text style={styles.label}>Reasoning</Text>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {expanded ? (
        <View style={styles.body}>
          {isRedacted ? (
            <Text style={styles.redacted}>Reasoning redacted</Text>
          ) : (
            <Text style={styles.content}>{block.thinking}</Text>
          )}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.bg.card,
    overflow: 'hidden',
    marginVertical: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: {
    color: dark.text.secondary,
    fontSize: font.sm,
    fontWeight: '600',
  },
  chevron: {
    color: dark.text.secondary,
    fontSize: font.xs,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  content: {
    color: dark.text.secondary,
    fontSize: font.sm,
    lineHeight: font.sm * 1.5,
  },
  redacted: {
    color: dark.text.secondary,
    fontSize: font.sm,
    fontStyle: 'italic',
  },
})
