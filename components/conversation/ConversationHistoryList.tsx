import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import { CaretDown } from 'phosphor-react-native'
import { MessageItem } from '@/components/conversation/MessageItem'
import type { Message } from '@/types/api'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

// The message list core, shared by the tail history view and the anchored
// search view. It owns ONLY the FlashList and its native scroll config —
// FlashList v2 maintains bottom-anchoring, older-page-prepend position, and
// "list has drawn" signalling itself, so there is no JS scroll-orchestration
// here (that hand-rolled machinery is exactly what produced the gap/blink
// bugs). The two consumers differ only in whether native bottom-anchoring is
// on (tail) or off with app-driven scrolling (anchored search).

// A newly-arrived message animates in only if it lands within this many rows of
// the tail — so a live append fades in, but a jump/backfill of older history
// does not animate a screenful at once.
const ANIMATE_TAIL_WINDOW = 8

export interface ConversationHistoryListProps {
  messages: Message[]
  lastMessageId: string | undefined
  /** Search keyword to highlight, and the row it belongs to. Anchored view only. */
  highlight?: string
  highlightIndex?: number
  onMatchLayout?: (messageIndex: number, y: number) => void
  /** Fired once FlashList has drawn its items — the signal to lift the skeleton. */
  onReady?: () => void
  /** Reached the top → load older history. */
  onStartReached?: () => void
  /** Reached the bottom → load newer messages (anchored view only). */
  onEndReached?: () => void
  /** Anchored view disables native bottom-anchoring and drives scroll itself. */
  disableAutoAnchor?: boolean
  isFetchingOlder?: boolean
  isFetchingNewer?: boolean
  onLayout?: (e: LayoutChangeEvent) => void
  contentContainerStyle?: object
}

export const ConversationHistoryList = forwardRef<FlashListRef<Message>, ConversationHistoryListProps>(
  function ConversationHistoryList(
    {
      messages,
      lastMessageId,
      highlight,
      highlightIndex,
      onMatchLayout,
      onReady,
      onStartReached,
      onEndReached,
      disableAutoAnchor,
      isFetchingOlder,
      isFetchingNewer,
      onLayout,
      contentContainerStyle,
    },
    ref,
  ) {
    const { t } = useTranslation(['conversation', 'common'])
    const theme = useTheme()
    const styles = useMemo(() => makeStyles(theme), [theme])

    // Own the list ref internally (the FABs need it even when the parent — the
    // tail view — passes no ref) and expose the live methods through the
    // forwarded ref so the search view can drive scrolling. Each method reads
    // listRef.current at call time, so a null capture at mount can't stick.
    const listRef = useRef<FlashListRef<Message>>(null)
    useImperativeHandle(
      ref,
      () =>
        ({
          scrollToIndex: (params) => listRef.current?.scrollToIndex(params) ?? Promise.resolve(),
          scrollToEnd: (params) => listRef.current?.scrollToEnd(params),
          scrollToOffset: (params) => listRef.current?.scrollToOffset(params),
        }) as FlashListRef<Message>,
      [],
    )

    const [showScrollTop, setShowScrollTop] = useState(false)
    const [showScrollBottom, setShowScrollBottom] = useState(false)

    // Ids that should play the fade-in-from-bottom entrance. A message id not yet
    // seen is new; it animates ONLY when it lands in the tail window (a live
    // append), never at the head (older-history page load). The whole loaded
    // history present on first render is seeded silently so nothing animates on a
    // cold open. Ids are only ever ADDED — FadeInDown fires once on the row's
    // mount, so keeping the id set-membership stable can't re-trigger it, and it
    // keeps the row's component type (Animated.View) from flipping mid-animation.
    //
    // Held in state so a new tail row re-renders the list; `epoch` bumps only
    // when the set grows, so renderItem's identity (and FlashList's cells) stay
    // stable across the far more common no-new-message reloads.
    const animateIdsRef = useRef<Set<string>>(new Set())
    const seededRef = useRef(false)
    const [animateEpoch, setAnimateEpoch] = useState(0)
    /* eslint-disable react-hooks/refs -- render-time seen/animate id cache; see note above */
    if (!seededRef.current) {
      seededRef.current = true
      animateIdsRef.current = new Set() // seed nothing → history renders silently
      messages.forEach((m) => animateIdsRef.current.add(`seen:${m.id}`))
    } else {
      const set = animateIdsRef.current
      const tailStart = Math.max(0, messages.length - ANIMATE_TAIL_WINDOW)
      let grew = false
      messages.forEach((m, i) => {
        const seenKey = `seen:${m.id}`
        if (!set.has(seenKey)) {
          set.add(seenKey)
          if (i >= tailStart) {
            set.add(m.id)
            grew = true
          }
        }
      })
      if (grew) setAnimateEpoch((e) => e + 1)
    }
    const animateIds = animateIdsRef.current
    /* eslint-enable react-hooks/refs */

    const renderItem = useCallback(
      ({ item }: { item: Message }) => (
        <MessageItem
          message={item}
          isLast={item.id === lastMessageId}
          highlight={highlight && item.messageIndex === highlightIndex ? highlight : undefined}
          onMatchLayout={onMatchLayout}
          animateIn={animateIds.has(item.id)}
        />
      ),
      // animateIds is a stable ref; animateEpoch re-keys this only when it grew.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [lastMessageId, highlight, highlightIndex, onMatchLayout, animateEpoch],
    )

    // Distinguish row shapes so FlashList only recycles cells of the same kind;
    // without this a recycled tool-card cell can bleed under a text row.
    const getItemType = useCallback((item: Message) => {
      const hasToolOrDiff = item.content.some(
        (b) =>
          b.type === 'thinking' ||
          b.type === 'tool_use' ||
          b.type === 'tool_result' ||
          b.type === 'diff',
      )
      if (hasToolOrDiff) return 'tool'
      return item.role === 'user' ? 'user' : 'assistant'
    }, [])

    // FlashList v2 owns bottom-anchoring; the tail view opts into the chat
    // preset. The anchored view disables it so its own scrollToIndex wins.
    const maintainVisibleContentPosition = useMemo(
      () =>
        disableAutoAnchor
          ? { disabled: true }
          : { autoscrollToBottomThreshold: 0.2, startRenderingFromBottom: true },
      [disableAutoAnchor],
    )

    // Only drives the two scroll FABs — no pagination or scroll logic here.
    const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
      const distFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height
      setShowScrollTop(contentOffset.y > 200)
      setShowScrollBottom(distFromBottom > 100)
    }, [])

    const scrollToTop = useCallback(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true })
    }, [])

    const scrollToBottom = useCallback(() => {
      listRef.current?.scrollToEnd({ animated: true })
    }, [])

    return (
      <View style={styles.wrapper} onLayout={onLayout}>
        <FlashList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          getItemType={getItemType}
          contentContainerStyle={contentContainerStyle}
          maintainVisibleContentPosition={maintainVisibleContentPosition}
          onLoad={onReady}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onStartReached={onStartReached}
          onStartReachedThreshold={0.3}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={
            isFetchingOlder ? (
              <View style={styles.pageLoading}>
                <ActivityIndicator color={theme.text.secondary} />
              </View>
            ) : null
          }
          ListFooterComponent={
            isFetchingNewer ? (
              <View style={styles.pageLoading}>
                <ActivityIndicator color={theme.text.secondary} />
              </View>
            ) : null
          }
        />
        {showScrollTop ? (
          <TouchableOpacity
            style={[styles.scrollBtn, styles.scrollBtnTop]}
            onPress={scrollToTop}
            accessibilityLabel="Scroll to top"
          >
            <Text style={styles.scrollBtnText}>{t('common:nav.top')}</Text>
          </TouchableOpacity>
        ) : null}
        {showScrollBottom ? (
          <TouchableOpacity
            style={styles.scrollBtnBottom}
            onPress={scrollToBottom}
            accessibilityLabel={t('action.scrollToBottom')}
            accessibilityRole="button"
            activeOpacity={0.75}
          >
            <CaretDown size={20} color="#fff" weight="bold" />
          </TouchableOpacity>
        ) : null}
      </View>
    )
  },
)

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    wrapper: { flex: 1 },
    pageLoading: {
      paddingVertical: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollBtn: {
      position: 'absolute',
      alignSelf: 'center',
      backgroundColor: theme.text.accent,
      borderRadius: 20,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    scrollBtnTop: { top: spacing.md },
    scrollBtnBottom: {
      position: 'absolute',
      right: spacing.md,
      bottom: spacing.md,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.text.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    },
    scrollBtnText: { color: '#fff', fontSize: font.sm, fontWeight: '600' },
  })
}
