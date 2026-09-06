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
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import { CaretDown } from 'phosphor-react-native'
import { MessageItem } from '@/components/conversation/MessageItem'
import { InheritedHistoryDivider } from '@/components/conversation/InheritedHistoryDivider'
import type { Message } from '@/types/api'
import type { InheritedHistorySeam } from '@/utils/inheritedHistory'
import { spacing, type Theme } from '@/constants/theme'
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

const UNAVAILABLE_SEAM: InheritedHistorySeam = { kind: 'unavailable' }

export interface ConversationHistoryListProps {
  messages: Message[]
  lastMessageId: string | undefined
  /** Search keyword to highlight. Tinted in every row; `highlightIndex` marks the active one. */
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
  /** Fork seam to mark, when the conversation inherited history from a parent. */
  inheritedHistory?: InheritedHistorySeam
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
      inheritedHistory,
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

    const [showScrollBottom, setShowScrollBottom] = useState(false)
    const showTopVal = useSharedValue(0)

    const topBtnStyle = useAnimatedStyle(() => ({
      opacity: withTiming(showTopVal.value, { duration: 220 }),
      pointerEvents: showTopVal.value > 0 ? 'auto' : 'none',
    }))

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
    // Keyed on the messages array identity so the O(messages) walk runs only
    // when data actually changes, not on every unrelated re-render (FAB state,
    // theme). Ids can only be added on a data change, so this is behavior-
    // preserving; the epoch bump stays a render-phase update, which is how the
    // first render of a new tail row already carries animateIn=true.
    /* eslint-disable react-hooks/refs -- render-time seen/animate id cache; see note above */
    useMemo(() => {
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
    }, [messages])
    const animateIds = animateIdsRef.current
    /* eslint-enable react-hooks/refs */

    // Drawn as part of the boundary message's row rather than as its own list
    // item, so the seam survives paging without a second `data` shape.
    const dividerSeam =
      inheritedHistory?.kind === 'divider' ? inheritedHistory : undefined

    const renderItem = useCallback(
      ({ item }: { item: Message }) => (
        <>
          {dividerSeam && item.messageIndex === dividerSeam.beforeMessageIndex ? (
            <InheritedHistoryDivider seam={dividerSeam} />
          ) : null}
          <MessageItem
            message={item}
            isLast={item.id === lastMessageId}
            highlight={highlight}
            isActiveMatch={Boolean(highlight) && item.messageIndex === highlightIndex}
            onMatchLayout={onMatchLayout}
            animateIn={animateIds.has(item.id)}
          />
        </>
      ),
      // animateIds is a stable ref; animateEpoch re-keys this only when it grew.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [lastMessageId, highlight, highlightIndex, onMatchLayout, animateEpoch, dividerSeam],
    )

    // Item type drives two FlashList v2 mechanisms: the recycling pool AND the
    // per-type running-average height used to place rows that haven't been
    // measured yet. Real conversations span ~46pt (collapsed Reasoning header)
    // to ~3,100pt (markdown-table answers), so lumping every thinking/tool/diff
    // row into one 'tool' pool poisons that average — measured as ±10-20k pt
    // content-size swings that shove the mVCP anchor around while scrolling up
    // (the blank-gap / viewport-teleport bug). Split by the row's dominant
    // shape so each pool's average tracks rows that actually look alike.
    const getItemType = useCallback((item: Message) => {
      let hasThinking = false
      let hasTool = false
      let hasDiff = false
      for (const b of item.content) {
        if (b.type === 'thinking') hasThinking = true
        else if (b.type === 'tool_use' || b.type === 'tool_result') hasTool = true
        else if (b.type === 'diff') hasDiff = true
      }
      if (hasDiff) return 'diff'
      if (hasTool) return 'tool'
      if (hasThinking) return 'thinking'
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

    // FlashList re-lays-out the header/footer whenever the element identity
    // changes, and an inline conditional recreates it on every parent render —
    // during an onStartReached page fetch that churn feeds extra mVCP anchor
    // corrections (upstream guidance: keep these stable, Shopify/flash-list#1844).
    // Memoized so identity only changes when the fetching state itself flips —
    // which is also why the source-missing notice enters as a primitive rather
    // than as the seam object.
    const showSourceMissing = inheritedHistory?.kind === 'unavailable'
    const listHeader = useMemo(
      () =>
        isFetchingOlder || showSourceMissing ? (
          <>
            {showSourceMissing ? <InheritedHistoryDivider seam={UNAVAILABLE_SEAM} /> : null}
            {isFetchingOlder ? (
              <View style={styles.pageLoading}>
                <ActivityIndicator color={theme.text.secondary} />
              </View>
            ) : null}
          </>
        ) : null,
      [isFetchingOlder, showSourceMissing, styles, theme],
    )
    const listFooter = useMemo(
      () =>
        isFetchingNewer ? (
          <View style={styles.pageLoading}>
            <ActivityIndicator color={theme.text.secondary} />
          </View>
        ) : null,
      [isFetchingNewer, styles, theme],
    )

    // Only drives the two scroll FABs — no pagination or scroll logic here.
    const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
      const distFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height
      showTopVal.value = contentOffset.y > 200 ? 1 : 0
      setShowScrollBottom(distFromBottom > 100)
    }, [showTopVal])

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
          // drawDistance is PIXELS of pre-rendered runway, not rows, and the
          // iOS default is 250 — split 70/30 toward the scroll direction, so
          // scrolling up pre-renders only ~350px above the viewport and evicts
          // rows ~150px below it. A single table answer here measures ~3,100px
          // (≈5 viewports), so the default buffer is outrun by any real flick
          // and just-passed rows unmount into visible blanks. 2000px keeps the
          // engaged window ahead of momentum scrolling and clears the known-bad
          // "item taller than 2×drawDistance" mVCP-correction regime
          // (Shopify/flash-list#2136) for rows up to 4,000px.
          drawDistance={2000}
          contentContainerStyle={contentContainerStyle}
          maintainVisibleContentPosition={maintainVisibleContentPosition}
          onLoad={onReady}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onStartReached={onStartReached}
          onStartReachedThreshold={0.3}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
        />
        <Animated.View
          style={[styles.scrollBtn, styles.scrollBtnTop, topBtnStyle]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={styles.scrollBtnInner}
            onPress={scrollToTop}
            accessibilityLabel={t('common:nav.scrollToTop')}
            testID="conversation-scroll-top"
          >
            <Text style={styles.scrollBtnText}>{t('common:nav.top')}</Text>
          </TouchableOpacity>
        </Animated.View>
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
    },
    scrollBtnTop: { top: spacing.md },
    // Translucent so message text stays legible underneath — this pill sits over
    // the centered text column, not in a gutter. Matches ConversationList and
    // TerminalOutput.
    scrollBtnInner: {
      backgroundColor: 'rgba(31, 111, 235, 0.14)',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: 'rgba(88, 166, 255, 0.2)',
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    scrollBtnBottom: {
      position: 'absolute',
      end: spacing.md,
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
    scrollBtnText: { color: 'rgba(230, 237, 243, 0.6)', fontSize: 12, fontWeight: '500' },
  })
}
