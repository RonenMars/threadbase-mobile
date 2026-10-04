import React, { memo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { MAX_FONT_SIZE_MULTIPLIER_MONO } from '@/constants/a11y'
import { ltrContentStyle, layoutDirectionStyle } from '@/lib/rtl'
import type { InlineSpan, MarkdownBlock } from '@/lib/markdown'

/**
 * Parsed markdown drawn in the terminal view's own idiom: monospace, LTR, the
 * `TerminalOutput` palette. The chat view gets its own renderer over the same
 * blocks — see docs/design/markdown-rendering.md for why the parse is shared
 * and the render is not.
 *
 * Headings change weight and color, never `fontSize`: a taller row breaks the
 * 18pt rhythm the PTY rows below it keep, and poisons FlashList's per-type
 * height average.
 */

function Spans({ spans }: { spans: InlineSpan[] }) {
  return (
    <>
      {spans.map((span, i) => {
        switch (span.kind) {
          case 'text':
            return <Text key={i}>{span.text}</Text>
          case 'strong':
            return <Text key={i} style={styles.strong}>{span.text}</Text>
          case 'em':
            return <Text key={i} style={styles.em}>{span.text}</Text>
          case 'code':
            return <Text key={i} style={styles.inlineCode}>{span.text}</Text>
          case 'strike':
            return <Text key={i} style={styles.strike}>{span.text}</Text>
          // Styled but not pressable. Opening an agent-supplied URL from a
          // terminal row is its own decision, not a side effect of rendering.
          case 'link':
            return <Text key={i} style={styles.link}>{span.text}</Text>
        }
      })}
    </>
  )
}

function Line({ spans, style }: { spans: InlineSpan[]; style?: Text['props']['style'] }) {
  return (
    <Text
      style={style ? [styles.text, style] : styles.text}
      selectable
      maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER_MONO}
    >
      <Spans spans={spans} />
    </Text>
  )
}

function Block({ block }: { block: MarkdownBlock }) {
  switch (block.kind) {
    case 'paragraph':
      return <Line spans={block.spans} />

    case 'heading':
      return <Line spans={block.spans} style={block.level <= 2 ? styles.headingMajor : styles.headingMinor} />

    case 'quote':
      return (
        <View style={styles.quoteRow}>
          <View style={styles.quoteRule} />
          <View style={styles.quoteBody}>
            <Line spans={block.spans} style={styles.dim} />
          </View>
        </View>
      )

    case 'listItem':
      return (
        <View style={[styles.itemRow, { paddingStart: block.depth * 12 }]}>
          <Text
            style={[styles.text, styles.marker]}
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER_MONO}
          >
            {block.marker}
          </Text>
          <View style={styles.itemBody}>
            <Line spans={block.spans} />
          </View>
        </View>
      )

    case 'rule':
      return <View style={styles.rule} />

    case 'code':
      // No Prism here. The terminal is already monospace, and tokenizing is
      // tens of ms on the JS thread per block (see MessageBubble's memo note) —
      // too much for a list that re-binds cells while a turn streams.
      return (
        <View style={styles.codeBlock}>
          <Text
            style={[styles.text, styles.codeBody]}
            selectable
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER_MONO}
          >
            {block.code}
          </Text>
        </View>
      )
  }
}

export const TerminalMarkdown = memo(function TerminalMarkdown({
  blocks,
}: {
  blocks: MarkdownBlock[]
}) {
  return (
    <View style={styles.container} testID="terminal-markdown">
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    ...layoutDirectionStyle('ltr'),
    gap: 2,
  },
  text: {
    ...ltrContentStyle,
    color: '#e6edf3',
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  strong: {
    fontWeight: '700',
    color: '#ffffff',
  },
  em: {
    fontStyle: 'italic',
  },
  strike: {
    textDecorationLine: 'line-through',
    color: '#8b949e',
  },
  inlineCode: {
    color: '#79c0ff',
  },
  link: {
    color: '#58a6ff',
    textDecorationLine: 'underline',
  },
  dim: {
    color: '#8b949e',
  },
  // Weight and color only — see the component note on why not fontSize.
  headingMajor: {
    color: '#ffffff',
    fontWeight: '700',
  },
  headingMinor: {
    color: '#d2a8ff',
    fontWeight: '600',
  },
  itemRow: {
    flexDirection: 'row',
  },
  marker: {
    width: 14,
    color: '#8b949e',
  },
  itemBody: {
    flex: 1,
  },
  quoteRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 1,
  },
  quoteRule: {
    width: 2,
    backgroundColor: '#30363d',
    borderRadius: 1,
  },
  quoteBody: {
    flex: 1,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#30363d',
    marginVertical: 5,
  },
  codeBlock: {
    backgroundColor: '#161b22',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#21262d',
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginVertical: 2,
  },
  codeBody: {
    color: '#c9d1d9',
  },
})
