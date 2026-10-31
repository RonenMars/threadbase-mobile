import React, { useMemo, useRef, useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { CaretLeft, CaretRight } from 'phosphor-react-native'
import { colorForToken } from '@/components/sessions/SessionStatusBadge'
import { spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useReduceMotion } from '@/hooks/useAccessibilitySettings'
import { BOARD_COLUMNS, boardScrollX, type BoardColumnId } from '@/lib/boardColumns'
import { useAppDirection } from '@/lib/rtl'
import { BoardChips, columnLabel, columnToken } from './BoardChips'

const PANE_WIDTH = 264
const STRIP_WIDTH = 36

interface Props {
  counts: Record<BoardColumnId, number>
  column: BoardColumnId
  onSelect: (id: BoardColumnId) => void
  renderColumn: (id: BoardColumnId) => React.ReactNode
}

/**
 * All columns side by side, for 768 and up on web and iPad. Chips and arrows
 * bring a column into view; an empty column folds to a strip and unfolds by
 * itself when a session lands in it.
 */
export function DesktopBoard({ counts, column, onSelect, renderColumn }: Props) {
  const { t } = useTranslation('sessions')
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const reduceMotion = useReduceMotion()
  const { isRTL } = useAppDirection()
  const track = useRef<ScrollView>(null)
  const columnX = useRef<Partial<Record<BoardColumnId, number>>>({})
  const [content, setContent] = useState(0)
  const [viewport, setViewport] = useState(0)

  const reveal = (id: BoardColumnId) => {
    onSelect(id)
    const x = columnX.current[id]
    if (x === undefined) return
    track.current?.scrollTo({ x: boardScrollX(x, { content, viewport, rtl: isRTL, web: Platform.OS === 'web' }) - spacing.md, animated: !reduceMotion })
  }

  const index = BOARD_COLUMNS.indexOf(column)
  const allFit = content <= viewport
  const atStart = index === 0
  const atEnd = index === BOARD_COLUMNS.length - 1
  // Row order follows the direction, so "previous" already sits on the right in RTL; only the glyphs swap.
  const PreviousIcon = isRTL ? CaretRight : CaretLeft
  const NextIcon = isRTL ? CaretLeft : CaretRight

  return (
    <View style={styles.fill} testID="desktop-board">
      <View style={styles.topRow}>
        <BoardChips counts={counts} selected={column} onSelect={reveal} />
        {allFit ? null : (
          <View style={styles.arrows}>
            <Pressable
              style={[styles.arrow, atStart && styles.arrowOff]}
              disabled={atStart}
              onPress={() => reveal(BOARD_COLUMNS[index - 1])}
              accessibilityRole="button"
              accessibilityState={{ disabled: atStart }}
              accessibilityLabel={t('boardTab.previousColumn')}
              testID="board-arrow-previous"
            >
              <PreviousIcon size={18} color={theme.text.primary} />
            </Pressable>
            <Pressable
              style={[styles.arrow, atEnd && styles.arrowOff]}
              disabled={atEnd}
              onPress={() => reveal(BOARD_COLUMNS[index + 1])}
              accessibilityRole="button"
              accessibilityState={{ disabled: atEnd }}
              accessibilityLabel={t('boardTab.nextColumn')}
              testID="board-arrow-next"
            >
              <NextIcon size={18} color={theme.text.primary} />
            </Pressable>
          </View>
        )}
      </View>
      <ScrollView
        ref={track}
        horizontal
        testID="board-track"
        style={styles.fill}
        contentContainerStyle={styles.track}
        onLayout={(e) => setViewport(e.nativeEvent.layout.width)}
        onContentSizeChange={(width) => setContent(width)}
      >
        {BOARD_COLUMNS.map((id) => {
          const label = columnLabel(id, t)
          const dot = <View style={[styles.dot, { backgroundColor: colorForToken(theme, columnToken(id)) }]} />
          const measure = { onLayout: (e: { nativeEvent: { layout: { x: number } } }) => { columnX.current[id] = e.nativeEvent.layout.x } }
          if (counts[id] === 0) {
            return (
              <View key={id} {...measure} style={styles.strip} accessible accessibilityLabel={`${label} 0`} testID={`board-strip-${id}`}>
                {dot}
                <Text style={styles.stripText} numberOfLines={1}>{label}</Text>
              </View>
            )
          }
          return (
            <View key={id} {...measure} style={styles.pane} testID={`board-pane-${id}`}>
              <View style={styles.paneHead}>
                {dot}
                <Text style={styles.paneTitle} numberOfLines={1}>{label}</Text>
                <Text style={styles.paneCount}>{counts[id]}</Text>
              </View>
              {renderColumn(id)}
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    fill: { flex: 1 },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingEnd: spacing.md },
    arrows: { flexDirection: 'row', gap: 6 },
    arrow: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
    arrowOff: { opacity: 0.4 },
    track: { flexGrow: 1, gap: 12, paddingStart: spacing.md },
    pane: { width: PANE_WIDTH, gap: spacing.sm },
    paneHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, height: 28, paddingHorizontal: spacing.md },
    paneTitle: { flexShrink: 1, color: theme.text.primary, fontSize: 13, fontWeight: '600' },
    paneCount: { color: theme.text.secondary, fontSize: 13, opacity: 0.65, fontVariant: ['tabular-nums'] },
    dot: { width: 8, height: 8, borderRadius: 4 },
    strip: {
      width: STRIP_WIDTH,
      height: 400,
      alignSelf: 'flex-start',
      alignItems: 'center',
      gap: spacing.sm,
      paddingTop: spacing.sm,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      opacity: 0.55,
      overflow: 'hidden',
    },
    // Rotated rather than writing-mode, which native layout does not have.
    stripText: { width: 200, marginTop: 96, textAlign: 'center', color: theme.text.secondary, fontSize: 13, fontWeight: '600', transform: [{ rotate: '90deg' }] },
  })
}
