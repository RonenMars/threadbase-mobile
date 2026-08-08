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
import { MAX_FONT_SIZE_MULTIPLIER_MONO, MIN_TOUCH_TARGET } from '@/constants/a11y'
import type { TerminalLine } from '@/hooks/useTerminalStream'
import { parseQuestionBlock, type QuestionBlock } from '@/utils/parseQuestionBlock'
import { collapseWrappedUserLines } from '@/lib/collapseWrappedUserLines'
import { QuestionCard } from '@/components/terminal/QuestionCard'
import { RenderErrorBoundary } from '@/components/RenderErrorBoundary'
import i18n from '@/lib/i18n'

// Strip any remaining ANSI escape codes that slipped through the VT
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b(\[[0-9;?]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[A-Z\\])/g, '')
}

const USER_PREFIX_RE = /^[❯›>]\s(.*)$/

// A line is user-owned when it's a `❯|›|> <text>` transcript row AND either the
// streamer confirmed `<text>` as ground truth (userMessageTexts) or the set is
// empty — old streamers send no user_message, so fall back to the heuristic.
function isUserLine(clean: string, userMessageTexts?: Set<string>): boolean {
  const m = clean.trim().match(USER_PREFIX_RE)
  if (!m) return false
  if (!userMessageTexts || userMessageTexts.size === 0) return true
  return userMessageTexts.has(m[1].trim())
}

interface LineRowProps {
  line: string
  index: number
  userMessageTexts?: Set<string>
}

// Gutter renders the line number. Split out + memoised on `index` only so
// `LineText` (the heavier ANSI-strip + styled <Text>) doesn't re-render when
// only the position changes — which happens on every WS frame.
const LineGutter = memo(function LineGutter({ index }: { index: number }) {
  return (
    <Text
      style={styles.lineNum}
      selectable={false}
      maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER_MONO}
    >
      {index + 1}
    </Text>
  )
})

const LineText = memo(function LineText({
  line,
  userMessageTexts,
  accessibilityLabel,
}: {
  line: string
  userMessageTexts?: Set<string>
  accessibilityLabel?: string
}) {
  const clean = stripAnsi(line)
  const userOwned = isUserLine(clean, userMessageTexts)
  return (
    <Text
      style={userOwned ? [styles.lineText, styles.lineTextUser] : styles.lineText}
      selectable
      maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER_MONO}
      accessibilityLabel={accessibilityLabel}
    >
      {clean}
    </Text>
  )
})

const LineRow = memo(function LineRow({ line, index, userMessageTexts }: LineRowProps) {
  const clean = stripAnsi(line)
  const a11yLabel = i18n.t('terminal:a11y.line', { n: index + 1, text: clean })
  return (
    <RenderErrorBoundary tag="terminal_line" rawFallback={clean}>
      <View
        style={styles.lineRow}
        testID="terminal-line-row"
      >
        <LineGutter index={index} />
        <LineText line={line} userMessageTexts={userMessageTexts} accessibilityLabel={a11yLabel} />
      </View>
    </RenderErrorBoundary>
  )
})

interface Props {
  lines: TerminalLine[]
  isStreaming: boolean
  /** Ground-truth user-message texts from the stream; empty → heuristic fallback. */
  userMessageTexts?: Set<string>
  onSendInput?: (text: string) => void
  onSendKeys?: (keys: string) => void
  /** Structured question / permission gate from the WS stream (takes precedence over PTY scrape). */
  activeQuestion?: QuestionBlock | null
  /** Answer a structured AskUserQuestion (POST). Permission gates answer via onSendKeys. */
  onAnswer?: (toolUseId: string, answers: Record<string, string | string[]>) => void
  /**
   * Resumed sessions start a fresh PTY — prior terminal bytes are gone.
   * When set, show a scrollback-top disclosure linking to the durable conversation.
   */
  onViewResumedConversation?: () => void
  /** Same destination as view, but opens in-chat search with the keyboard up. */
  onSearchResumedConversation?: () => void
}

export function TerminalOutput({
  lines,
  isStreaming: _isStreaming,
  userMessageTexts,
  onSendInput,
  onSendKeys,
  activeQuestion,
  onAnswer,
  onViewResumedConversation,
  onSearchResumedConversation,
}: Props) {
  const { t } = useTranslation('common')
  const { t: tTerminal } = useTranslation('terminal')
  const collapsedLines = useMemo(
    () => collapseWrappedUserLines(lines, userMessageTexts),
    [lines, userMessageTexts],
  )
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
    return <LineRow line={item} index={index} userMessageTexts={userMessageTexts} />
  }, [userMessageTexts])

  // Stable keys by content + per-content occurrence. Positional keys broke
  // memoisation: every WS frame's `.slice(-maxLines)` shifted indices, so
  // FlatList unmounted and remounted every row instead of reusing them.
  // Computed once per `lines` change so FlatList can call keyExtractor in any order.
  const keys = useMemo(() => {
    const counts = new Map<string, number>()
    return collapsedLines.map((item) => {
      const c = counts.get(item) ?? 0
      counts.set(item, c + 1)
      return `${item}#${c}`
    })
  }, [collapsedLines])
  const keyExtractor = useCallback((_item: TerminalLine, i: number) => keys[i], [keys])

  const questionBlock = useMemo(() => {
    if (!onSendKeys) return null
    // Defense in depth on top of parseQuestionBlock's numbered-cursor rule:
    // drop lines the streamer confirmed as user messages so a `❯ <text>`
    // prompt echo can never be scraped as a menu cursor.
    const window = collapsedLines.slice(-30).filter((l) => !isUserLine(stripAnsi(l), userMessageTexts))
    return parseQuestionBlock(window)
  }, [collapsedLines, onSendKeys, userMessageTexts])

  const handleOptionSelect = useCallback((_questionIndex: number, optionIndex: number) => {
    if (!onSendKeys || !questionBlock) return
    const start = questionBlock.selectedIndex ?? 0
    const delta = optionIndex - start
    const arrow = delta > 0 ? '\x1b[B' : '\x1b[A'
    const keys = arrow.repeat(Math.abs(delta)) + '\r'
    onSendKeys(keys)
  }, [onSendKeys, questionBlock])

  const handleStructuredSelect = useCallback((questionIndex: number, optionIndex: number) => {
    if (!activeQuestion) return
    if (activeQuestion.source === 'permission') {
      const realIndex = activeQuestion.permissionIndices?.[optionIndex]
      if (realIndex !== undefined) onSendKeys?.(`${realIndex}\r`)
      return
    }
    if (!activeQuestion.toolUseId) return
    const q = activeQuestion.questions[questionIndex]
    onAnswer?.(activeQuestion.toolUseId, { [q.question]: q.options[optionIndex].label })
  }, [activeQuestion, onAnswer, onSendKeys])

  const listHeader = useMemo(() => {
    if (!onViewResumedConversation) return null
    const onSearch = onSearchResumedConversation ?? onViewResumedConversation
    const linkA11y = [
      tTerminal('session.resumedHistoryLinkView'),
      tTerminal('session.resumedHistoryLinkOr').trim(),
      tTerminal('session.resumedHistoryLinkSearch'),
      tTerminal('session.resumedHistoryLinkIn').trim(),
      tTerminal('session.resumedHistoryLinkTail'),
    ].join(' ')
    return (
      <View
        style={styles.resumedNotice}
        accessibilityLabel={`${tTerminal('session.resumedEmptyScrollback')} ${linkA11y}`}
        testID="terminal-resumed-scrollback-notice"
      >
        <Text style={styles.resumedNoticeText}>{tTerminal('session.resumedEmptyScrollback')}</Text>
        <Text style={styles.resumedNoticeLinkRow}>
          <Text
            style={styles.resumedNoticeLink}
            onPress={onViewResumedConversation}
            accessibilityRole="link"
            accessibilityLabel={tTerminal('session.resumedHistoryLinkView')}
            testID="terminal-resumed-history-view"
          >
            {tTerminal('session.resumedHistoryLinkView')}
          </Text>
          <Text style={styles.resumedNoticePlain}>{tTerminal('session.resumedHistoryLinkOr')}</Text>
          <Text
            style={styles.resumedNoticeLink}
            onPress={onSearch}
            accessibilityRole="link"
            accessibilityLabel={tTerminal('session.resumedHistoryLinkSearch')}
            testID="terminal-resumed-history-search"
          >
            {tTerminal('session.resumedHistoryLinkSearch')}
          </Text>
          <Text style={styles.resumedNoticePlain}>{tTerminal('session.resumedHistoryLinkIn')}</Text>
          <Text
            style={styles.resumedNoticeLink}
            onPress={onViewResumedConversation}
            accessibilityRole="link"
            accessibilityLabel={tTerminal('session.resumedHistoryLinkTail')}
            testID="terminal-resumed-history-tail"
          >
            {tTerminal('session.resumedHistoryLinkTail')}
          </Text>
        </Text>
      </View>
    )
  }, [onSearchResumedConversation, onViewResumedConversation, tTerminal])

  return (
    <View style={styles.container}>
      <FlashList
        ref={listRef}
        data={collapsedLines}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        maintainVisibleContentPosition={{
          startRenderingFromBottom: true,
          autoscrollToBottomThreshold: 0.2,
        }}
        contentContainerStyle={styles.listContent}
      />

      {activeQuestion ? (
        <QuestionCard
          block={activeQuestion}
          onSelect={handleStructuredSelect}
          onCancel={onSendKeys ? () => onSendKeys('\x1b') : undefined}
        />
      ) : questionBlock && onSendKeys ? (
        <QuestionCard
          block={questionBlock}
          onSelect={handleOptionSelect}
          onCancel={() => onSendKeys('\x1b')}
        />
      ) : null}

      <Animated.View style={[styles.jumpBtn, styles.jumpBtnTop, topBtnStyle]} pointerEvents="box-none">
        <TouchableOpacity
          onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
          accessibilityLabel={t('nav.scrollToTop')}
          style={styles.jumpBtnInner}
        >
          <Text style={styles.jumpBtnText}>{t('nav.top')}</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[styles.jumpBtn, bottomBtnStyle]} pointerEvents="box-none">
        <TouchableOpacity
          onPress={jumpToBottom}
          accessibilityLabel={t('nav.scrollToBottom')}
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
  resumedNotice: {
    marginHorizontal: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#21262d',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
    gap: 4,
  },
  resumedNoticeText: {
    color: '#8b949e',
    fontSize: 12,
    lineHeight: 16,
  },
  resumedNoticeLinkRow: {
    color: '#8b949e',
    fontSize: 12,
    lineHeight: 16,
  },
  resumedNoticePlain: {
    color: '#8b949e',
    fontSize: 12,
    lineHeight: 16,
  },
  resumedNoticeLink: {
    color: '#58a6ff',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
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
  lineTextUser: {
    color: '#58a6ff',
    fontWeight: '600',
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
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  jumpBtnText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '500',
  },
})
