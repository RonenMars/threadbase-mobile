import React, { useRef, useCallback, memo, useMemo, useEffect } from 'react'
import {
  FlatList,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { spacing } from '@/constants/theme'
import type { TerminalLine } from '@/hooks/useTerminalStream'

// Strip any remaining ANSI escape codes that slipped through the VT
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b(\[[0-9;?]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[A-Z\\])/g, '')
}

/** Detect line type for styling */
type LineType = 'tool' | 'diff-add' | 'diff-del' | 'diff-header' | 'default'

function classifyLine(line: string): LineType {
  const trimmed = line.trimStart()
  if (/^[◻◼●◐◑◒◓🔧🪛📁]\s/.test(trimmed)) return 'tool'
  if (/^[+]\s/.test(trimmed) && !trimmed.startsWith('+++')) return 'diff-add'
  if (/^[-]\s/.test(trimmed) && !trimmed.startsWith('---')) return 'diff-del'
  if (/^diff --git|^@@/.test(trimmed)) return 'diff-header'
  return 'default'
}

const LINE_STYLE: Record<LineType, { color: string; bg?: string }> = {
  'tool': { color: '#79c0ff' },
  'diff-add': { color: '#7ee787', bg: 'rgba(46, 160, 67, 0.1)' },
  'diff-del': { color: '#ff7b72', bg: 'rgba(248, 81, 73, 0.1)' },
  'diff-header': { color: '#d2a8ff' },
  'default': { color: '#e6edf3' },
}

const DividerRow = memo(function DividerRow({ text }: { text: string }) {
  return (
    <View style={styles.dividerRow} testID="divider-row">
      <Text style={styles.dividerLabel}>YOU</Text>
      <Text style={styles.dividerText} numberOfLines={1}>{text}</Text>
    </View>
  )
})

interface LineRowProps {
  line: string
  index: number
}

const LineRow = memo(function LineRow({ line, index }: LineRowProps) {
  const clean = stripAnsi(line)
  const type = classifyLine(clean)
  const style = LINE_STYLE[type]

  return (
    <View
      style={[styles.lineRow, style.bg ? { backgroundColor: style.bg } : undefined]}
      testID="terminal-line-row"
    >
      <Text style={styles.lineNum} selectable={false}>{index + 1}</Text>
      <Text style={[styles.lineText, { color: style.color }]} selectable>{clean}</Text>
    </View>
  )
})

interface Props {
  lines: TerminalLine[]
  isStreaming: boolean
}

export function TerminalOutput({ lines, isStreaming }: Props) {
  const { t } = useTranslation('common')
  const listRef = useRef<FlatList>(null)
  const showJumpButtonVal = useSharedValue(0)
  const showTopButtonVal = useSharedValue(0)
  const isAtBottomRef = useRef(true)
  const isStreamingRef = useRef(isStreaming)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevScrollY = useRef(0)
  const contentHeightRef = useRef(0)

  useEffect(() => { isStreamingRef.current = isStreaming }, [isStreaming])
  useEffect(() => () => { if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current) }, [])

  const bottomBtnStyle = useAnimatedStyle(() => ({
    opacity: withTiming(showJumpButtonVal.value, { duration: 200 }),
    pointerEvents: showJumpButtonVal.value > 0 ? 'auto' : 'none',
  }))
  const topBtnStyle = useAnimatedStyle(() => ({
    opacity: withTiming(showTopButtonVal.value, { duration: 200 }),
    pointerEvents: showTopButtonVal.value > 0 ? 'auto' : 'none',
  }))

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
    const y = contentOffset.y
    const scrollingUp = y < prevScrollY.current
    prevScrollY.current = y
    const distanceFromBottom = contentSize.height - y - layoutMeasurement.height
    const atBottom = distanceFromBottom < 50
    isAtBottomRef.current = atBottom
    showJumpButtonVal.value = atBottom ? 0 : 1
    showTopButtonVal.value = scrollingUp && y > 100 ? 1 : 0
  }, [showJumpButtonVal, showTopButtonVal])

  const scrollToBottom = useCallback((animated: boolean) => {
    listRef.current?.scrollToOffset({ offset: contentHeightRef.current, animated })
  }, [])

  const jumpToBottom = useCallback(() => {
    scrollToBottom(true)
    showJumpButtonVal.value = 0
  }, [scrollToBottom, showJumpButtonVal])

  const renderItem = useCallback(({ item, index }: { item: TerminalLine; index: number }) => {
    if (typeof item !== 'string' && item.__divider) {
      return <DividerRow text={item.text} />
    }
    return <LineRow line={item as string} index={index} />
  }, [])

  // Stable keys by content + per-content occurrence. Positional keys broke
  // memoisation: every WS frame's `.slice(-maxLines)` shifted indices, so
  // FlatList unmounted and remounted every row instead of reusing them.
  // Computed once per `lines` change so FlatList can call keyExtractor in any order.
  const keys = useMemo(() => {
    const counts = new Map<string, number>()
    return lines.map((item) => {
      const text = typeof item === 'string' ? `t:${item}` : `d:${item.text}`
      const c = counts.get(text) ?? 0
      counts.set(text, c + 1)
      return `${text}#${c}`
    })
  }, [lines])
  const keyExtractor = useCallback((_item: TerminalLine, i: number) => keys[i], [keys])

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={lines}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        onScrollBeginDrag={() => { isAtBottomRef.current = false }}
        onContentSizeChange={(_w, h) => {
          contentHeightRef.current = h
          if (isStreamingRef.current) return
          if (!isAtBottomRef.current) return
          if (scrollTimerRef.current !== null) clearTimeout(scrollTimerRef.current)
          scrollTimerRef.current = setTimeout(() => {
            scrollTimerRef.current = null
            if (isAtBottomRef.current) scrollToBottom(false)
          }, 0)
        }}
        initialNumToRender={40}
        maxToRenderPerBatch={20}
        windowSize={10}
        removeClippedSubviews
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />

      <Animated.View style={[styles.jumpBtn, styles.jumpBtnTop, topBtnStyle]} pointerEvents="box-none">
        <TouchableOpacity
          onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
          accessibilityLabel="Jump to top"
          style={styles.jumpBtnInner}
        >
          <Text style={styles.jumpBtnText}>{t('nav.top')}</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[styles.jumpBtn, bottomBtnStyle]} pointerEvents="box-none">
        <TouchableOpacity
          onPress={jumpToBottom}
          accessibilityLabel="Jump to bottom"
          style={styles.jumpBtnInner}
        >
          <Text style={styles.jumpBtnText}>{t('nav.bottom')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#21262d',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  lineRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 3,
  },
  lineNum: {
    color: '#484f58',
    fontSize: 11,
    fontFamily: 'monospace',
    width: 36,
    textAlign: 'right',
    paddingRight: 8,
    userSelect: 'none',
  },
  lineText: {
    color: '#e6edf3',
    fontSize: 12,
    fontFamily: 'monospace',
    flex: 1,
    lineHeight: 18,
  },
  jumpBtn: {
    position: 'absolute',
    bottom: spacing.md,
    alignSelf: 'center',
  },
  jumpBtnTop: {
    bottom: undefined,
    top: spacing.md,
  },
  jumpBtnInner: {
    backgroundColor: 'rgba(31, 111, 235, 0.18)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(88, 166, 255, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  jumpBtnText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '500',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: 'rgba(31, 111, 235, 0.10)',
    borderLeftWidth: 3,
    borderLeftColor: '#58a6ff',
    marginVertical: 2,
  },
  dividerLabel: {
    color: '#58a6ff',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 0.6,
  },
  dividerText: {
    color: '#cdd9e5',
    fontSize: 12,
    fontFamily: 'monospace',
    flex: 1,
  },
})
