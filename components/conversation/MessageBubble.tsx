import React, { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useTranslation } from 'react-i18next'
import { dark, font, radius, spacing } from '@/constants/theme'
import type { Message, MessageContent } from '@/types/api'

const MAX_COLLAPSED_LINES = 10
const MAX_COLLAPSED_CHARS = 600

interface Props {
  message: Message
}

function decodeEntities(s: string) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function TextContent({ text }: { text: string }) {
  return <Text style={styles.messageText} selectable>{text}</Text>
}

const MAX_CODE_LINES = 20

function CodeBlock({ code }: { code: string }) {
  const { t } = useTranslation('conversation')
  const [expanded, setExpanded] = useState(false)
  const copy = () => Clipboard.setStringAsync(code)
  const lines = code.split('\n')
  const shouldCollapse = lines.length > MAX_CODE_LINES
  const displayed = shouldCollapse && !expanded
    ? lines.slice(0, MAX_CODE_LINES).join('\n')
    : code

  return (
    <View style={styles.codeBlock}>
      <View style={styles.codeHeader}>
        <Text style={styles.codeHeaderText}>{t('message.code')}</Text>
        <TouchableOpacity onPress={copy} style={styles.codeCopyBtn}>
          <Text style={styles.codeCopyText}>{t('action.copyCode')}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexShrink: 1, maxHeight: 300 }}>
        <Text style={styles.codeText} selectable>{displayed}</Text>
      </ScrollView>
      {shouldCollapse ? (
        <TouchableOpacity onPress={() => setExpanded((v) => !v)} style={styles.codeExpandBtn}>
          <Text style={styles.codeExpandText}>
            {expanded ? 'Show less' : `Show all ${lines.length} lines`}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

function TextBlockBody({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const decoded = decodeEntities(text)
  const lines = decoded.split('\n')
  const shouldCollapse =
    lines.length > MAX_COLLAPSED_LINES || decoded.length > MAX_COLLAPSED_CHARS

  let displayed: string
  if (shouldCollapse && !expanded) {
    const byLines = lines.slice(0, MAX_COLLAPSED_LINES).join('\n')
    displayed =
      (byLines.length > MAX_COLLAPSED_CHARS
        ? byLines.slice(0, MAX_COLLAPSED_CHARS)
        : byLines) + '\n...'
  } else {
    displayed = decoded
  }

  const parts = displayed.split(/(```[\s\S]*?```)/g)

  return (
    <View style={styles.gap}>
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const code = part.slice(3, -3).replace(/^\w+\n/, '')
          return <CodeBlock key={i} code={code} />
        }
        return <TextContent key={i} text={part} />
      })}
      {shouldCollapse ? (
        <TouchableOpacity onPress={() => setExpanded((v) => !v)}>
          <Text style={styles.expandBtn}>
            {expanded ? 'Show less' : `Show all ${lines.length} lines`}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

function ContentBlock({ block }: { block: MessageContent }) {
  if (block.type === 'text') {
    return <TextBlockBody text={block.text} />
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

export function MessageBubble({ message }: Props) {
  const { t } = useTranslation('conversation')
  const isUser = message.role === 'user'

  return (
    <View style={[styles.container, isUser ? styles.containerUser : styles.containerAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {message.content.map((block, i) => (
          <ContentBlock key={i} block={block} />
        ))}
        {message.tokens ? (
          <Text style={styles.tokens}>{t('message.tokens', { count: message.tokens })}</Text>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    marginVertical: spacing.xs,
  },
  containerUser: { alignItems: 'flex-end' },
  containerAssistant: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '85%',
    alignSelf: 'flex-start',
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#1f6feb',
    borderBottomRightRadius: radius.sm,
  },
  bubbleAssistant: {
    backgroundColor: dark.bg.card,
    borderWidth: 1,
    borderColor: dark.border,
    borderBottomLeftRadius: radius.sm,
  },
  messageText: {
    color: dark.text.primary,
    fontSize: font.base,
    lineHeight: 22,
  },
  expandBtn: {
    color: dark.text.accent,
    fontSize: font.sm,
    marginTop: spacing.xs,
  },
  codeBlock: {
    backgroundColor: dark.bg.primary,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  codeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: '#1c2128',
  },
  codeHeaderText: {
    color: dark.text.secondary,
    fontSize: font.xs,
  },
  codeCopyBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  codeCopyText: {
    color: dark.text.accent,
    fontSize: font.xs,
  },
  codeText: {
    color: '#e6edf3',
    fontFamily: 'monospace',
    fontSize: font.xs,
    padding: spacing.sm,
  },
  codeExpandBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#1c2128',
  },
  codeExpandText: {
    color: dark.text.accent,
    fontSize: font.xs,
  },
  toolTag: {
    backgroundColor: `${dark.text.accent}20`,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  toolTagText: {
    color: dark.text.accent,
    fontSize: font.xs,
  },
  tokens: {
    color: dark.text.secondary,
    fontSize: font.xs,
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
  },
  gap: { gap: spacing.xs },
})
