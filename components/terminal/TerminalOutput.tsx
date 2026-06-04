import React, { useRef, useCallback, memo, useMemo, useState } from 'react'
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import { useTranslation } from 'react-i18next'
import { spacing } from '@/constants/theme'
import type { TerminalLine } from '@/hooks/useTerminalStream'

// Strip any remaining ANSI escape codes that slipped through the VT
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b(\[[0-9;?]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[A-Z\\])/g, '')
}

interface LineRowProps {
  line: string
  index: number
}

// Gutter renders the line number. Split out + memoised on `index` only so
// `LineText` (the heavier ANSI-strip + styled <Text>) doesn't re-render when
// only the position changes — which happens on every WS frame.
const LineGutter = memo(function LineGutter({ index }: { index: number }) {
  return <Text style={styles.lineNum} selectable={false}>{index + 1}</Text>
})

const LineText = memo(function LineText({ line }: { line: string }) {
  const clean = stripAnsi(line)
  return <Text style={styles.lineText} selectable>{clean}</Text>
})

// Outer wrapper stays cheap (only `index` changes); LineText memoises on `line`.
const LineRow = memo(function LineRow({ line, index }: LineRowProps) {
  return (
    <View
      style={styles.lineRow}
      testID="terminal-line-row"
    >
      <LineGutter index={index} />
      <LineText line={line} />
    </View>
  )
})

interface Props {
  lines: TerminalLine[]
  isStreaming: boolean
}

export function TerminalOutput({ lines, isStreaming: _isStreaming }: Props) {
  const { t } = useTranslation('common')
  const listRef = useRef<FlashListRef<TerminalLine>>(null)
  // mVCP handles the "follow" decision itself; we only track scroll position
  // here to drive the jump-to-top / jump-to-bottom pill visibility. Plain
  // useState (not Reanimated shared values) because FlashList v2 calls
  // onScroll via Animated.event listener → useAnimatedScrollHandler's worklet
  // wrapper raises "undefined is not a function" inside RecyclerView.
  const prevScrollYRef = useRef(0)
  const [showJumpButton, setShowJumpButton] = useState(0)
  const [showTopButton, setShowTopButton] = useState(0)
  const showJumpButtonVal = useSharedValue(0)
  const showTopButtonVal = useSharedValue(0)
  showJumpButtonVal.value = showJumpButton
  showTopButtonVal.value = showTopButton

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
    const scrollingUp = y < prevScrollYRef.current
    prevScrollYRef.current = y
    const distanceFromBottom = contentSize.height - y - layoutMeasurement.height
    const atBottom = distanceFromBottom < 50
    setShowJumpButton(atBottom ? 0 : 1)
    setShowTopButton(scrollingUp && y > 100 ? 1 : 0)
  }, [])

  const scrollToBottom = useCallback((animated: boolean) => {
    listRef.current?.scrollToEnd({ animated })
  }, [])

  const jumpToBottom = useCallback(() => {
    scrollToBottom(true)
    setShowJumpButton(0)
  }, [scrollToBottom])

  const renderItem = useCallback(({ item, index }: { item: TerminalLine; index: number }) => {
    return <LineRow line={item} index={index} />
  }, [])

  // Stable keys by content + per-content occurrence. Positional keys broke
  // memoisation: every WS frame's `.slice(-maxLines)` shifted indices, so
  // FlatList unmounted and remounted every row instead of reusing them.
  // Computed once per `lines` change so FlatList can call keyExtractor in any order.
  const keys = useMemo(() => {
    const counts = new Map<string, number>()
    return lines.map((item) => {
      const c = counts.get(item) ?? 0
      counts.set(item, c + 1)
      return `${item}#${c}`
    })
  }, [lines])
  const keyExtractor = useCallback((_item: TerminalLine, i: number) => keys[i], [keys])

  return (
    <View style={styles.container}>
      <FlashList
        ref={listRef}
        data={lines}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        maintainVisibleContentPosition={{
          startRenderingFromBottom: true,
          autoscrollToBottomThreshold: 0.2,
        }}
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
})
