import React, { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { type BoardColumnId } from '@/lib/boardColumns'
import { BoardChips } from './BoardChips'
import { ColumnPager } from './ColumnPager'

interface Props {
  columns: readonly BoardColumnId[]
  counts: Record<BoardColumnId, number>
  column: BoardColumnId
  onSelect: (id: BoardColumnId) => void
  renderColumn: (id: BoardColumnId) => React.ReactNode
  animate: boolean
}

/** One column at a time, full width: swipe between them, or pick one from the chips. */
export function PhoneBoard({ columns, counts, column, onSelect, renderColumn, animate }: Props) {
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  return (
    <View style={styles.fill} testID="phone-board">
      <BoardChips columns={columns} counts={counts} selected={column} onSelect={onSelect} animate={animate} />
      <View style={styles.dots} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {columns.map((id) => (
          <View key={id} style={[styles.dot, id === column && styles.dotOn]} />
        ))}
      </View>
      <ColumnPager keys={columns} index={columns.indexOf(column)} onIndexChange={(i) => onSelect(columns[i])} animate={animate}>
        {columns.map((id) => renderColumn(id))}
      </ColumnPager>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    fill: { flex: 1 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingBottom: 8 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.border },
    dotOn: { width: 16, backgroundColor: theme.text.accent },
  })
}
