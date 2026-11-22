import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native'
import { font, radius, spacing } from '@/constants/theme'
import { useThemedStyles } from '@/hooks/useThemedStyles'
import type { InlineSpan, TableAlign } from '@/lib/markdown'

/**
 * A GFM table in a chat bubble. React Native has no table layout, so a cell
 * cannot take its column's width from the widest cell in it. Each column gets a
 * width worked out from its text length instead, and a row is a plain flex row:
 * every row of a column then has the same width, and a cell that wraps makes
 * its whole row taller. The grid scrolls sideways when it is wider than the
 * bubble.
 *
 * Cell content arrives as spans plus a `renderSpans` callback, so the table
 * draws links, code and emphasis exactly as the surrounding prose does without
 * importing the chat renderer (which imports this).
 */

// An average glyph advance at `font.sm`, rounded up: a column slightly too wide
// costs a little padding, one slightly too narrow wraps a word onto a new line.
const CHAR_WIDTH = 8
const CELL_PADDING = spacing.sm
const MIN_COLUMN_WIDTH = 48
const MAX_COLUMN_WIDTH = 220

function textLength(spans: InlineSpan[]): number {
  return spans.reduce((n, s) => n + s.text.length, 0)
}

export function columnWidths(header: InlineSpan[][], rows: InlineSpan[][][]): number[] {
  return header.map((_, c) => {
    const longest = Math.max(textLength(header[c]), ...rows.map((row) => textLength(row[c] ?? [])))
    const width = Math.ceil(longest * CHAR_WIDTH) + CELL_PADDING * 2
    return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, width))
  })
}

interface Props {
  align: TableAlign[]
  header: InlineSpan[][]
  rows: InlineSpan[][][]
  renderSpans: (spans: InlineSpan[]) => ReactNode
  /** The bubble's text style, so a cell inherits colour and writing direction. */
  textStyle?: StyleProp<TextStyle>
  isUser?: boolean
}

export function MarkdownTable({ align, header, rows, renderSpans, textStyle, isUser }: Props) {
  const { styles, theme } = useThemedStyles(makeStyles)
  const widths = columnWidths(header, rows)
  // On a user bubble the fill is the accent colour, so the neutral border
  // would vanish into it.
  const borderColor = isUser ? `${theme.text.onAccent}59` : theme.border

  const renderRow = (cells: InlineSpan[][], key: string, isHeader: boolean, isFirst: boolean) => (
    <View key={key} style={[styles.row, !isFirst && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderColor }]}>
      {cells.map((cell, c) => (
        <View
          key={c}
          style={[styles.cell, { width: widths[c] }, c > 0 && { borderStartWidth: StyleSheet.hairlineWidth, borderStartColor: borderColor }]}
        >
          <Text
            selectable
            style={[
              textStyle,
              styles.cellText,
              isHeader && styles.headerText,
              align[c] !== 'default' && { textAlign: align[c] },
            ]}
          >
            {renderSpans(cell)}
          </Text>
        </View>
      ))}
    </View>
  )

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      testID="markdown-table"
    >
      <View style={[styles.grid, { borderColor }]} testID="markdown-table-grid">
        {renderRow(header, 'header', true, true)}
        {rows.map((row, r) => renderRow(row, `row-${r}`, false, false))}
      </View>
    </ScrollView>
  )
}

function makeStyles() {
  return StyleSheet.create({
    // flexGrow 0 so a bubble that is only a table shrinks to the grid instead
    // of stretching the scroll view to the bubble's maximum width.
    scroll: {
      flexGrow: 0,
      marginVertical: spacing.xs,
    },
    grid: {
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: radius.sm,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
    },
    cell: {
      paddingHorizontal: CELL_PADDING,
      paddingVertical: spacing.xs,
    },
    cellText: {
      fontSize: font.sm,
      lineHeight: 18,
    },
    headerText: {
      fontWeight: '700',
    },
  })
}
