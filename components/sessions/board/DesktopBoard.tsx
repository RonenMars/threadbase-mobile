import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Platform, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { CaretLeft, CaretRight } from 'phosphor-react-native'
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated'
import { colorForToken } from '@/components/sessions/SessionStatusBadge'
import { spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { boardScrollX, type BoardColumnId } from '@/lib/boardColumns'
import { useAppDirection } from '@/lib/rtl'
import { BoardChips, columnLabel, columnToken } from './BoardChips'

const PANE_WIDTH = 264

interface Props {
  columns: readonly BoardColumnId[]
  counts: Record<BoardColumnId, number>
  column: BoardColumnId
  onSelect: (id: BoardColumnId) => void
  renderColumn: (id: BoardColumnId) => React.ReactNode
  animate: boolean
}

/**
 * The visible columns side by side, for 768 and up on web and iPad. Chips and
 * arrows bring a column into view, and so does the board moving the selection.
 */
export function DesktopBoard({ columns, counts, column, onSelect, renderColumn, animate }: Props) {
  const { t } = useTranslation('sessions')
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const { isRTL } = useAppDirection()
  const track = useRef<ScrollViewInstance>(null)
  const columnX = useRef<Partial<Record<BoardColumnId, number>>>({})
  const [content, setContent] = useState(0)
  const [viewport, setViewport] = useState(0)

  const shown = useRef(column)
  // A column that has just appeared has no x yet; its pane scrolls itself in once laid out.
  const pending = useRef<BoardColumnId | null>(null)
  const scrollTo = (x: number) => {
    track.current?.scrollTo({ x: boardScrollX(x, { content, viewport, rtl: isRTL, web: Platform.OS === 'web' }) - spacing.md, animated: animate })
  }
  useEffect(() => {
    if (shown.current === column) return
    shown.current = column
    const x = columnX.current[column]
    pending.current = x === undefined ? column : null
    if (x !== undefined) scrollTo(x)
  })

  const index = columns.indexOf(column)
  const allFit = content <= viewport
  const atStart = index === 0
  const atEnd = index === columns.length - 1
  // Row order follows the direction, so "previous" already sits on the right in RTL; only the glyphs swap.
  const PreviousIcon = isRTL ? CaretRight : CaretLeft
  const NextIcon = isRTL ? CaretLeft : CaretRight

  return (
    <View style={styles.fill} testID="desktop-board">
      <View style={styles.topRow}>
        <BoardChips columns={columns} counts={counts} selected={column} onSelect={onSelect} animate={animate} />
        {allFit ? null : (
          <View style={styles.arrows}>
            <Pressable
              style={[styles.arrow, atStart && styles.arrowOff]}
              disabled={atStart}
              onPress={() => onSelect(columns[index - 1])}
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
              onPress={() => onSelect(columns[index + 1])}
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
        {columns.map((id) => (
          <Animated.View
            key={id}
            entering={animate ? FadeIn : undefined}
            exiting={animate ? FadeOut : undefined}
            layout={animate ? LinearTransition : undefined}
            onLayout={(e) => {
              columnX.current[id] = e.nativeEvent.layout.x
              if (pending.current !== id) return
              pending.current = null
              scrollTo(e.nativeEvent.layout.x)
            }}
            style={styles.pane}
            testID={`board-pane-${id}`}
          >
            <View style={styles.paneHead}>
              <View style={[styles.dot, { backgroundColor: colorForToken(theme, columnToken(id)) }]} />
              <Text style={styles.paneTitle} numberOfLines={1}>{columnLabel(id, t)}</Text>
              <Text style={styles.paneCount}>{counts[id]}</Text>
            </View>
            {renderColumn(id)}
          </Animated.View>
        ))}
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
  })
}
