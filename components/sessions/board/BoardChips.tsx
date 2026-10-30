import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { colorForToken } from '@/components/sessions/SessionStatusBadge'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useReduceMotion } from '@/hooks/useAccessibilitySettings'
import { BOARD_COLUMNS, boardScrollX, type BoardColumnId } from '@/lib/boardColumns'
import { useAppDirection } from '@/lib/rtl'
import type { SessionColorToken } from '@/lib/sessionPresentation'

export function columnLabel(id: BoardColumnId, t: TFunction<'sessions'>): string {
  switch (id) {
    case 'needsYou':
      return t('status.needsYou')
    case 'working':
      return t('status.working')
    case 'observed':
      return t('status.observed')
    case 'earlier':
      return t('boardTab.earlier')
  }
}

export function columnToken(id: BoardColumnId): SessionColorToken {
  switch (id) {
    case 'needsYou':
      return 'waiting'
    case 'working':
      return 'running'
    case 'observed':
      return 'completed'
    case 'earlier':
      return 'idle'
  }
}

interface Props {
  counts: Record<BoardColumnId, number>
  selected: BoardColumnId
  onSelect: (id: BoardColumnId) => void
}

/** One scrolling line of the four columns. An empty one stays, dimmed with its 0, so positions never shift. */
export function BoardChips({ counts, selected, onSelect }: Props) {
  const { t } = useTranslation('sessions')
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const reduceMotion = useReduceMotion()
  const { isRTL } = useAppDirection()
  const scroller = useRef<ScrollView>(null)
  const [chipX, setChipX] = useState<Partial<Record<BoardColumnId, number>>>({})
  const size = useRef({ content: 0, viewport: 0 })

  // Also what brings Needs you on screen first in RTL, where the content starts at its far end.
  const x = chipX[selected]
  useEffect(() => {
    if (x === undefined) return
    const left = boardScrollX(x, { ...size.current, rtl: isRTL, web: Platform.OS === 'web' })
    scroller.current?.scrollTo({ x: left - spacing.md, animated: !reduceMotion })
  }, [x, isRTL, reduceMotion])

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.row}
      contentContainerStyle={styles.chips}
      accessibilityRole="tablist"
      accessibilityLabel={t('boardTab.columns')}
      onLayout={(e) => { size.current.viewport = e.nativeEvent.layout.width }}
      onContentSizeChange={(width) => { size.current.content = width }}
    >
      {BOARD_COLUMNS.map((id) => {
        const isSelected = id === selected
        return (
          <Pressable
            key={id}
            onPress={() => onSelect(id)}
            onLayout={(e) => {
              const chip = e.nativeEvent.layout.x
              setChipX((prev) => (prev[id] === chip ? prev : { ...prev, [id]: chip }))
            }}
            style={[styles.chip, isSelected && styles.chipSelected, counts[id] === 0 && styles.chipEmpty]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            testID={`board-column-${id}`}
          >
            <View style={[styles.dot, { backgroundColor: colorForToken(theme, columnToken(id)) }]} />
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{columnLabel(id, t)}</Text>
            <Text style={styles.chipCount}>{counts[id]}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    row: { flexGrow: 0, flexShrink: 1 },
    chips: { gap: spacing.xs + 2, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm + 2 },
    chip: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs + 2,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bg.card,
    },
    chipSelected: { borderColor: theme.text.accent, backgroundColor: `${theme.text.accent}24` },
    chipEmpty: { opacity: 0.55 },
    chipText: { color: theme.text.secondary, fontSize: font.xs, fontWeight: '600' },
    chipTextSelected: { color: theme.text.primary },
    chipCount: { color: theme.text.secondary, fontSize: font.xs, fontVariant: ['tabular-nums'] },
    dot: { width: 8, height: 8, borderRadius: 4 },
  })
}
