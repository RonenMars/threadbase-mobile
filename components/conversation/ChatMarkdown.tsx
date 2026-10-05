import React, { useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { HighlightText, type MatchLayout } from 'one-more-highlight/native'
import { font, spacing, type Theme } from '@/constants/theme'
import { useThemedStyles } from '@/hooks/useThemedStyles'
import type { RtlStyleKit } from '@/lib/rtl'
import { spanSource, type InlineSpan, type MarkdownBlock } from '@/lib/markdown'
import { CodeBlock } from '@/components/conversation/CodeBlock'
import type { MatchAnchor } from '@/components/conversation/matchAnchor'

/**
 * Parsed markdown drawn as chat prose: themed, proportional, RTL-aware. The
 * terminal view renders the same blocks in its own idiom — see
 * docs/design/markdown-rendering.md for why the parse is shared and the render
 * is not.
 *
 * ## How this coexists with search
 *
 * The search target is resolved server-side against the raw JSONL
 * (`app/conversation/[id].tsx:176-182`), so the client has to be able to show
 * any match the server anchored to, and the anchored row additionally has to
 * report where that match sits so the screen can scroll to it.
 *
 * Nesting `HighlightText` inside a styled span would break both halves: on iOS
 * a nested `<Text>` is not its own native view, so `measureLayout` against the
 * row has nothing dependable to measure.
 *
 * So: **a line containing the needle renders as a root `HighlightText`, exactly
 * as the pre-markdown code did; every other line renders as markdown.** One
 * rule, no branching on whether this row is the anchor, and the measurement
 * path is byte-identical to the one it replaces. The cost is that a matched
 * line loses its bold for as long as a search is running, which is a fair trade
 * for never hiding a match.
 *
 * A needle is looked for in the line's rendered text first and its source
 * second, so searching for `blocks.ts` finds it inside `**blocks.ts**` (the
 * markers are gone from the rendered text) and searching for the literal
 * `**blocks.ts**` finds it too (the source still has them).
 */

interface Props {
  blocks: MarkdownBlock[]
  isUser?: boolean
  /** Already trimmed by the caller; undefined when no search is running. */
  highlight?: string
  matchAnchor?: MatchAnchor
  activeMatch?: boolean
}

function contains(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

/** The text a block renders to, markers removed. Empty for a rule or a fence. */
function renderedText(block: MarkdownBlock): string {
  if (block.kind === 'code' || block.kind === 'rule') return ''
  return block.spans.map((s) => s.text).join('')
}

/**
 * The text to highlight for a block, or null when the needle is not in it.
 * Rendered text wins so the common case keeps the markers out of the way.
 *
 * The fallback is the block's *inline* source, not `blockSource` — a list
 * item's bullet and a heading's hashes are drawn by this component, so
 * including them in the fallback text renders each one twice.
 */
function matchTextFor(block: MarkdownBlock, needle: string): string | null {
  if (block.kind === 'code' || block.kind === 'rule') return null
  const rendered = renderedText(block)
  if (contains(rendered, needle)) return rendered
  const source = block.spans.map(spanSource).join('')
  return contains(source, needle) ? source : null
}

function Spans({ spans, styles }: { spans: InlineSpan[]; styles: ReturnType<typeof makeStyles> }) {
  return (
    <>
      {spans.map((span, i) => {
        switch (span.kind) {
          // A bare string, not a nested `<Text>`: plain prose is the common
          // case and the wrapper added a node that carried no style of its own,
          // which also moved the styled node out from under anything querying
          // the rendered text.
          case 'text':
            return span.text
          case 'strong':
            return <Text key={i} style={styles.strong}>{span.text}</Text>
          case 'em':
            return <Text key={i} style={styles.em}>{span.text}</Text>
          case 'code':
            return <Text key={i} style={styles.inlineCode}>{span.text}</Text>
          case 'strike':
            return <Text key={i} style={styles.strike}>{span.text}</Text>
          // Styled, not pressable — same call as the terminal renderer: opening
          // an agent-supplied URL is its own decision, not a render side effect.
          case 'link':
            return <Text key={i} style={styles.link}>{span.text}</Text>
        }
      })}
    </>
  )
}

export function ChatMarkdown({ blocks, isUser, highlight, matchAnchor, activeMatch }: Props) {
  const { styles, theme } = useThemedStyles(makeStyles)
  const textRef = useRef<Text>(null)
  const needle = highlight && highlight.length > 0 ? highlight : undefined

  const baseStyle = isUser ? [styles.text, { color: theme.text.onAccent }] : styles.text

  // The first block carrying the needle owns the anchor report. Computed up
  // front so the render pass can compare indices instead of tracking state.
  let anchorIndex = -1
  if (needle) {
    anchorIndex = blocks.findIndex((b) => matchTextFor(b, needle) !== null)
  }

  const reportMatchLayout = matchAnchor
    ? (matches: readonly MatchLayout[]) => {
        const first = matches[0]
        const row = matchAnchor.rowRef.current
        if (!first || !row || !textRef.current) return
        textRef.current.measureLayout(row, (_x, y) => matchAnchor.onLayout(y + first.y))
      }
    : undefined

  const renderLine = (
    block: MarkdownBlock,
    index: number,
    extraStyle?: Text['props']['style'],
  ) => {
    const style = extraStyle ? [baseStyle, extraStyle] : baseStyle
    const match = needle ? matchTextFor(block, needle) : null
    if (match !== null) {
      const isAnchor = index === anchorIndex
      return (
        <HighlightText
          ref={isAnchor ? textRef : undefined}
          text={match}
          searchWords={[needle as string]}
          highlightStyle={activeMatch ? styles.match : styles.matchInactive}
          style={style}
          textProps={{ selectable: true }}
          onMatchesLayout={isAnchor ? reportMatchLayout : undefined}
        />
      )
    }
    return (
      <Text style={style} selectable>
        <Spans spans={block.kind === 'code' || block.kind === 'rule' ? [] : block.spans} styles={styles} />
      </Text>
    )
  }

  return (
    <View style={styles.container} testID="chat-markdown">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'code':
            return <CodeBlock key={i} code={block.code} language={block.language} />

          case 'rule':
            return <View key={i} style={styles.rule} />

          case 'heading':
            return (
              <View key={i} style={i === 0 ? undefined : styles.headingLead}>
                {renderLine(block, i, headingStyleFor(block.level, styles))}
              </View>
            )

          case 'quote':
            return (
              <View key={i} style={styles.quoteRow}>
                <View style={styles.quoteRule} />
                <View style={styles.quoteBody}>{renderLine(block, i, styles.quoteText)}</View>
              </View>
            )

          case 'listItem':
            return (
              <View key={i} style={[styles.itemRow, { paddingStart: block.depth * spacing.md }]}>
                <Text style={[baseStyle, styles.marker]}>{block.marker}</Text>
                <View style={styles.itemBody}>{renderLine(block, i)}</View>
              </View>
            )

          case 'paragraph':
            // The parser drops blank lines, so consecutive paragraphs are the
            // only surviving trace of one — without the lead they read as
            // wrapped lines of a single paragraph.
            return (
              <View key={i} style={i === 0 ? undefined : styles.paragraphLead}>
                {renderLine(block, i)}
              </View>
            )
        }
      })}
    </View>
  )
}

function headingStyleFor(level: number, styles: ReturnType<typeof makeStyles>) {
  if (level === 1) return styles.h1
  if (level === 2) return styles.h2
  return styles.h3
}

function makeStyles(theme: Theme, rtl: RtlStyleKit) {
  return StyleSheet.create({
    container: {
      gap: 2,
    },
    text: {
      color: theme.text.primary,
      fontSize: font.base,
      lineHeight: 22,
      ...rtl.copy,
    },
    strong: {
      fontWeight: '700',
    },
    em: {
      fontStyle: 'italic',
    },
    strike: {
      textDecorationLine: 'line-through',
      color: theme.text.secondary,
    },
    inlineCode: {
      fontFamily: 'monospace',
      fontSize: font.sm,
      color: theme.text.accent,
    },
    link: {
      color: theme.text.accent,
      textDecorationLine: 'underline',
    },
    // Chat is proportional and keeps no fixed row rhythm, so headings may grow
    // here where the terminal's may not. Kept modest all the same: taller rows
    // widen the spread FlashList averages per item type.
    h1: {
      fontSize: font.xl,
      lineHeight: 26,
      fontWeight: '700',
    },
    h2: {
      fontSize: font.lg,
      lineHeight: 23,
      fontWeight: '700',
    },
    h3: {
      fontSize: font.base,
      fontWeight: '700',
    },
    headingLead: {
      marginTop: spacing.sm,
    },
    paragraphLead: {
      marginTop: spacing.xs,
    },
    itemRow: {
      flexDirection: 'row',
    },
    marker: {
      minWidth: 16,
      paddingEnd: spacing.xs,
      color: theme.text.secondary,
    },
    itemBody: {
      flex: 1,
    },
    quoteRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingVertical: 2,
    },
    quoteRule: {
      width: 2,
      backgroundColor: theme.border,
      borderRadius: 1,
    },
    quoteBody: {
      flex: 1,
    },
    quoteText: {
      color: theme.text.secondary,
    },
    rule: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
      marginVertical: spacing.sm,
    },
    match: {
      backgroundColor: theme.text.highlight,
      color: theme.text.onHighlight,
      borderRadius: 3,
    },
    matchInactive: {
      backgroundColor: `${theme.text.highlight}59`,
      borderRadius: 3,
    },
  })
}
