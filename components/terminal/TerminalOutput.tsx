import React, { useRef, useState, useCallback, memo } from 'react'
import {
  FlatList,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { dark, font, spacing } from '@/constants/theme'

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

interface LineRowProps {
  line: string
  index: number
}

const LineRow = memo(({ line, index }: LineRowProps) => {
  const clean = stripAnsi(line)
  const type = classifyLine(clean)
  const style = LINE_STYLE[type]

  return (
    <View style={[styles.lineRow, style.bg ? { backgroundColor: style.bg } : undefined]}>
      <Text style={styles.lineNum} selectable={false}>{index + 1}</Text>
      <Text style={[styles.lineText, { color: style.color }]} selectable>{clean}</Text>
    </View>
  )
})

interface Props {
  lines: string[]
  isStreaming: boolean
}

export function TerminalOutput({ lines, isStreaming }: Props) {
  const listRef = useRef<FlatList>(null)
  const [showJumpButton, setShowJumpButton] = useState(false)
  const [showTopButton, setShowTopButton] = useState(false)
  const isAtBottomRef = useRef(true)

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
    const y = contentOffset.y
    const distanceFromBottom = contentSize.height - y - layoutMeasurement.height
    const atBottom = distanceFromBottom < 50
    isAtBottomRef.current = atBottom
    setShowJumpButton(!atBottom)
    setShowTopButton(y > 100)
  }, [])

  const jumpToBottom = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true })
    setShowJumpButton(false)
  }, [])

  const copyAll = useCallback(() => {
    Clipboard.setStringAsync(lines.join('\n'))
  }, [lines])

  const renderItem = useCallback(({ item, index }: { item: string; index: number }) => (
    <LineRow line={item} index={index} />
  ), [])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerDots}>
            <View style={[styles.dot, { backgroundColor: '#ff5f57' }]} />
            <View style={[styles.dot, { backgroundColor: '#febc2e' }]} />
            <View style={[styles.dot, { backgroundColor: '#28c840' }]} />
          </View>
          {isStreaming ? (
            <View style={styles.streamingBadge}>
              <View style={styles.streamingDot} />
              <Text style={styles.streamingLabel}>streaming</Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity onPress={copyAll} style={styles.copyBtn} accessibilityLabel="Copy all terminal output">
          <Text style={styles.copyBtnText}>Copy all</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={lines}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        onContentSizeChange={() => {
          if (isAtBottomRef.current) {
            listRef.current?.scrollToEnd({ animated: false })
          }
        }}
        initialNumToRender={40}
        maxToRenderPerBatch={20}
        windowSize={10}
        removeClippedSubviews
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />

      {showTopButton ? (
        <TouchableOpacity
          style={[styles.jumpBtn, styles.jumpBtnTop]}
          onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
          accessibilityLabel="Jump to top"
        >
          <Text style={styles.jumpBtnText}>↑ Top</Text>
        </TouchableOpacity>
      ) : null}
      {showJumpButton ? (
        <TouchableOpacity
          style={styles.jumpBtn}
          onPress={jumpToBottom}
          accessibilityLabel="Jump to bottom"
        >
          <Text style={styles.jumpBtnText}>↓ Jump to bottom</Text>
        </TouchableOpacity>
      ) : null}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161b22',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  streamingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(46, 160, 67, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  streamingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3fb950',
  },
  streamingLabel: {
    color: '#3fb950',
    fontSize: 11,
    fontWeight: '500',
  },
  copyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(110, 118, 129, 0.1)',
    minHeight: 28,
    justifyContent: 'center',
  },
  copyBtnText: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '500',
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
    backgroundColor: '#1f6feb',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  jumpBtnTop: {
    bottom: undefined,
    top: 48,
  },
  jumpBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
})
