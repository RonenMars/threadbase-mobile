import React, { useRef, useState, useCallback } from 'react'
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

// Strip ANSI escape codes for safe rendering
// A more advanced implementation would parse and render colors
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[mGKHF]/g, '')
}

interface Props {
  lines: string[]
  isStreaming: boolean
}

export function TerminalOutput({ lines, isStreaming }: Props) {
  const listRef = useRef<FlatList>(null)
  const [showJumpButton, setShowJumpButton] = useState(false)
  const isAtBottomRef = useRef(true)

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height
    const atBottom = distanceFromBottom < 50
    isAtBottomRef.current = atBottom
    setShowJumpButton(!atBottom)
  }, [])

  const jumpToBottom = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true })
    setShowJumpButton(false)
  }, [])

  const copyAll = useCallback(() => {
    Clipboard.setStringAsync(lines.join('\n'))
  }, [lines])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerDots}>
          <View style={[styles.dot, { backgroundColor: '#ff5f57' }]} />
          <View style={[styles.dot, { backgroundColor: '#febc2e' }]} />
          <View style={[styles.dot, { backgroundColor: '#28c840' }]} />
        </View>
        {isStreaming ? (
          <Text style={styles.streamingLabel}>● streaming</Text>
        ) : null}
        <TouchableOpacity onPress={copyAll} style={styles.copyBtn} accessibilityLabel="Copy all terminal output">
          <Text style={styles.copyBtnText}>Copy all</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={lines}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index }) => (
          <View style={styles.lineRow}>
            <Text style={styles.lineNum} selectable={false}>{index + 1}</Text>
            <Text style={styles.lineText} selectable>{stripAnsi(item)}</Text>
          </View>
        )}
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
    backgroundColor: dark.bg.primary,
    borderRadius: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c2128',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  headerDots: {
    flexDirection: 'row',
    gap: 5,
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  streamingLabel: {
    color: dark.status.running,
    fontSize: font.xs,
  },
  copyBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 44,
    justifyContent: 'center',
  },
  copyBtnText: {
    color: dark.text.secondary,
    fontSize: font.xs,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: spacing.sm,
  },
  lineRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  lineNum: {
    color: '#484f58',
    fontSize: font.xs,
    fontFamily: 'monospace',
    width: 32,
    textAlign: 'right',
    userSelect: 'none',
  },
  lineText: {
    color: '#e6edf3',
    fontSize: font.xs,
    fontFamily: 'monospace',
    flex: 1,
    flexWrap: 'wrap',
  },
  jumpBtn: {
    position: 'absolute',
    bottom: spacing.md,
    alignSelf: 'center',
    backgroundColor: dark.text.accent,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  jumpBtnText: {
    color: '#fff',
    fontSize: font.sm,
    fontWeight: '600',
  },
})
