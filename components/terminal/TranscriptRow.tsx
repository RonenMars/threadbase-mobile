import React, { memo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { MAX_FONT_SIZE_MULTIPLIER_MONO } from '@/constants/a11y'
import { layoutDirectionStyle, ltrContentStyle } from '@/lib/rtl'
import { cliPromptText } from '@/lib/cliPromptText'
import type { Message, MessageContent } from '@/types/api'

/**
 * One transcript message drawn the way the TUI would have drawn it: `❯` for
 * the user, `⏺` for the agent, a tool call as `Name(argument)` with its result
 * folded under it. Sits above the live PTY rows in the terminal view, so it
 * must read as terminal output, not as a chat bubble — monospace, LTR, the
 * same palette as `TerminalOutput`'s rows.
 */

// Rows of a result shown before it is folded; the rest is one tap away.
const RESULT_PREVIEW_LINES = 3
const SUMMARY_MAX_CHARS = 120

// Keys a tool's input usually carries its one-line identity under, in the
// order to try. Anything else falls back to the first string value.
const SUMMARY_KEYS = ['command', 'file_path', 'path', 'pattern', 'query', 'url', 'description', 'prompt']

function summariseInput(input: Record<string, unknown>): string {
  let value: unknown
  for (const key of SUMMARY_KEYS) {
    if (typeof input[key] === 'string' && (input[key] as string).length > 0) {
      value = input[key]
      break
    }
  }
  if (value === undefined) value = Object.values(input).find((v) => typeof v === 'string' && v.length > 0)
  if (typeof value !== 'string') return ''
  const oneLine = value.replace(/\s+/g, ' ').trim()
  return oneLine.length > SUMMARY_MAX_CHARS ? `${oneLine.slice(0, SUMMARY_MAX_CHARS - 1)}…` : oneLine
}

function indentContinuation(text: string): string {
  return text.trimEnd().split('\n').join('\n  ')
}

function Result({ block }: { block: Extract<MessageContent, { type: 'tool_result' }> }) {
  const { t } = useTranslation('terminal')
  const [expanded, setExpanded] = useState(false)
  const lines = block.content.trimEnd().split('\n')
  const hidden = lines.length - RESULT_PREVIEW_LINES
  const shown = expanded || hidden <= 0 ? lines : lines.slice(0, RESULT_PREVIEW_LINES)
  const body = `  ⎿  ${shown.join('\n     ')}`
  const foldLabel = expanded
    ? t('transcript.hideLines')
    : t('transcript.moreLines', { count: hidden })
  return (
    <>
      <Text
        style={block.isError ? [styles.text, styles.error] : [styles.text, styles.dim]}
        selectable
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER_MONO}
      >
        {body}
      </Text>
      {hidden > 0 ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={foldLabel}
          testID="terminal-transcript-fold"
          hitSlop={6}
        >
          <Text style={[styles.text, styles.fold]} maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER_MONO}>
            {`     … ${foldLabel}`}
          </Text>
        </Pressable>
      ) : null}
    </>
  )
}

function Block({ block, role }: { block: MessageContent; role: Message['role'] }) {
  switch (block.type) {
    case 'text': {
      if (role === 'user') {
        const prompt = cliPromptText(block.text).trim()
        if (!prompt) return null
        return (
          <Text style={[styles.text, styles.user]} selectable maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER_MONO}>
            {`❯ ${indentContinuation(prompt)}`}
          </Text>
        )
      }
      const text = block.text.trim()
      if (!text) return null
      return (
        <Text style={styles.text} selectable maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER_MONO}>
          {`⏺ ${indentContinuation(text)}`}
        </Text>
      )
    }
    case 'thinking': {
      const first = block.thinking.trim().split('\n')[0] ?? ''
      if (!first) return null
      return (
        <Text style={[styles.text, styles.dim]} selectable maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER_MONO}>
          {`✻ ${first}`}
        </Text>
      )
    }
    case 'tool_use': {
      const summary = summariseInput(block.input)
      return (
        <Text style={[styles.text, styles.tool]} selectable maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER_MONO}>
          {summary ? `⏺ ${block.name}(${summary})` : `⏺ ${block.name}`}
        </Text>
      )
    }
    case 'tool_result':
      return <Result block={block} />
    case 'diff':
      return (
        <Text style={[styles.text, styles.tool]} selectable maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER_MONO}>
          {`⏺ ${block.filename}`}
        </Text>
      )
    case 'question_answer':
      return null
  }
}

export const TranscriptRow = memo(function TranscriptRow({ message }: { message: Message }) {
  return (
    <View style={styles.row} testID="terminal-transcript-row">
      {message.content.map((block, i) => (
        <Block key={i} block={block} role={message.role} />
      ))}
    </View>
  )
})

const styles = StyleSheet.create({
  row: {
    ...layoutDirectionStyle('ltr'),
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: {
    ...ltrContentStyle,
    color: '#e6edf3',
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  user: {
    color: '#58a6ff',
    fontWeight: '600',
  },
  tool: {
    color: '#d2a8ff',
  },
  dim: {
    color: '#8b949e',
  },
  error: {
    color: '#ff7b72',
  },
  fold: {
    color: '#58a6ff',
  },
})
