import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, type LayoutChangeEvent } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import type { FlashListRef } from '@shopify/flash-list'
import { CaretDown, CaretUp, X } from 'phosphor-react-native'
import { ConversationHistoryList } from '@/components/conversation/ConversationHistoryList'
import type { Message } from '@/types/api'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { flexRow } from '@/lib/rtl'

// The anchored search view: given a resolved match set, it renders the shared
// history list with native bottom-anchoring OFF and drives scrolling itself —
// jumping to the active match and aiming at the keyword's y inside the row.
// The match-navigation state machine (prev/next, in-window scroll vs.
// out-of-window re-anchor) lives here; the screen only resolves the target and
// re-fetches when `fetchAnchor` moves outside the loaded window.

export interface ConversationSearchViewProps {
  messages: Message[]
  lastMessageId: string | undefined
  searchQuery: string
  /** All match message-indexes (tail-most last), from the resolver. */
  matchIndexes: number[]
  totalMatches: number | undefined
  /** The active match's message-index (the row to highlight + scroll to). */
  anchorIndex: number
  /** Position of the active match within matchIndexes. */
  activeMatchPos: number
  /** Step the active match; delta wraps. The screen owns re-anchoring. */
  onStep: (delta: 1 | -1, loadedRowIndex: number) => void
  /** Clears the active search. Conversation detail omits this and writes route params. */
  onClear?: () => void
  onReady?: () => void
  onStartReached?: () => void
  onEndReached?: () => void
  isFetchingOlder?: boolean
  isFetchingNewer?: boolean
  contentContainerStyle?: object
}

export function ConversationSearchView({
  messages,
  lastMessageId,
  searchQuery,
  matchIndexes,
  totalMatches,
  anchorIndex,
  activeMatchPos,
  onStep,
  onClear,
  onReady,
  onStartReached,
  onEndReached,
  isFetchingOlder,
  isFetchingNewer,
  contentContainerStyle,
}: ConversationSearchViewProps) {
  const { t } = useTranslation(['conversation', 'common'])
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const router = useRouter()

  const listRef = useRef<FlashListRef<Message>>(null)
  const listHeightRef = useRef(0)
  // Where the active match's first line sits inside its row, reported by the
  // highlighted bubble's text-layout measurement. Lets the scroll aim at the
  // keyword itself — centering the row alone strands the keyword off-screen
  // when the row is taller than the viewport.
  const matchLayoutRef = useRef<{ messageIndex: number; y: number } | null>(null)
  // Set when a jump ran before the match was measured; the measurement
  // callback then re-scrolls precisely once. Cleared when the user drags.
  const pendingMatchScrollRef = useRef(true)
  const anchorRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userHasScrolledRef = useRef(false)

  const handleListLayout = useCallback((e: LayoutChangeEvent) => {
    listHeightRef.current = e.nativeEvent.layout.height
  }, [])

  // Finds the anchor row in the loaded window and scrolls to it. Once the
  // highlighted bubble reports where the keyword sits inside the row
  // (matchLayoutRef), the scroll places that line a third down the viewport;
  // FlashList positions rows and knows nothing about the keyword's y inside
  // one, so centering the row alone strands the keyword for tall rows. Until
  // the measurement lands (or for matches inside code blocks, which never
  // report), fall back to centering the row.
  const scrollToAnchor = useCallback(
    (animated: boolean) => {
      if (!messages.length) return
      let index = messages.findIndex((m) => m.messageIndex === anchorIndex)
      if (index === -1) index = messages.length - 1
      const match = matchLayoutRef.current
      if (match?.messageIndex === anchorIndex && listHeightRef.current > 0) {
        // FlashList v2: finalOffset = rowTop + viewOffset at viewPosition 0, so
        // the match line (rowTop + match.y) lands listHeight/3 from the top.
        // Overshoot past the scrollable range is clamped by FlashList itself.
        void listRef.current?.scrollToIndex({
          index,
          animated,
          viewPosition: 0,
          viewOffset: match.y - listHeightRef.current / 3,
        })
      } else {
        void listRef.current?.scrollToIndex({ index, animated, viewPosition: 0.45 })
      }
    },
    [messages, anchorIndex],
  )

  const scrollToAnchorRef = useRef(scrollToAnchor)
  useEffect(() => {
    scrollToAnchorRef.current = scrollToAnchor
  }, [scrollToAnchor])

  // FlashList has drawn — jump to the anchor, then re-aim once after the rough
  // jump settles (the row may not have been measured on the first attempt).
  const handleReady = useCallback(() => {
    onReady?.()
    if (userHasScrolledRef.current) return
    scrollToAnchor(false)
    if (anchorRetryRef.current) clearTimeout(anchorRetryRef.current)
    anchorRetryRef.current = setTimeout(() => {
      anchorRetryRef.current = null
      if (!userHasScrolledRef.current) scrollToAnchor(true)
    }, 250)
  }, [onReady, scrollToAnchor])

  // Re-jump whenever the active match changes to a row already in the window.
  useEffect(() => {
    pendingMatchScrollRef.current = true
    userHasScrolledRef.current = false
    matchLayoutRef.current = null
    scrollToAnchorRef.current(true)
    // anchorIndex identity drives this; messages excluded so an unrelated
    // page-append doesn't re-jump the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorIndex])

  useEffect(() => {
    return () => {
      if (anchorRetryRef.current) clearTimeout(anchorRetryRef.current)
    }
  }, [])

  // Reports arrive from the highlighted row's text parts as they lay out; when
  // several parts contain the keyword, the topmost (first) match wins.
  const handleMatchLayout = useCallback((messageIndex: number, y: number) => {
    const current = matchLayoutRef.current
    matchLayoutRef.current =
      current?.messageIndex === messageIndex
        ? { messageIndex, y: Math.min(current.y, y) }
        : { messageIndex, y }
    if (pendingMatchScrollRef.current) {
      pendingMatchScrollRef.current = false
      if (anchorRetryRef.current) clearTimeout(anchorRetryRef.current)
      anchorRetryRef.current = setTimeout(() => {
        anchorRetryRef.current = null
        if (!userHasScrolledRef.current) scrollToAnchorRef.current(false)
      }, 300)
    }
  }, [])

  const goToMatch = useCallback(
    (delta: 1 | -1) => {
      if (matchIndexes.length === 0) return
      const nextPos = (activeMatchPos + delta + matchIndexes.length) % matchIndexes.length
      const nextIndex = matchIndexes[nextPos]
      const loadedRowIndex = messages.findIndex((m) => m.messageIndex === nextIndex)
      // In-window steps hand scroll control back to the app, so the drag flag
      // resets and the re-aim fires even after the user dragged.
      if (loadedRowIndex !== -1) {
        pendingMatchScrollRef.current = true
        userHasScrolledRef.current = false
      }
      onStep(delta, loadedRowIndex)
    },
    [matchIndexes, activeMatchPos, messages, onStep],
  )

  // The counter's numerator steps through matchIndexes, so the denominator must
  // count the same list. The streamer caps matchIndexes (last 1000) while
  // total_matches stays uncapped — show the navigable count with "+" when capped.
  const navigableMatches = matchIndexes.length
  const matchTotalLabel =
    totalMatches != null && totalMatches > navigableMatches
      ? `${navigableMatches}+`
      : String(totalMatches ?? navigableMatches)

  return (
    <>
      <View style={styles.matchNavBar} testID="search-match-nav">
        <Text style={styles.matchNavCount} testID="search-match-count">
          {t('search.matchCount', { current: activeMatchPos + 1, total: matchTotalLabel })}
        </Text>
        <View style={styles.matchNavActions}>
          <TouchableOpacity
            onPress={() => goToMatch(-1)}
            hitSlop={8}
            accessibilityLabel={t('search.previousMatch')}
            testID="search-match-prev"
            style={styles.matchNavBtn}
          >
            <CaretUp size={18} color={theme.text.primary} weight="bold" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => goToMatch(1)}
            hitSlop={8}
            accessibilityLabel={t('search.nextMatch')}
            testID="search-match-next"
            style={styles.matchNavBtn}
          >
            <CaretDown size={18} color={theme.text.primary} weight="bold" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => (onClear ? onClear() : router.setParams({ search: '', anchor_index: '' }))}
            hitSlop={8}
            accessibilityLabel={t('search.clearSearch')}
            testID="search-match-clear"
            style={styles.matchNavBtn}
          >
            <X size={18} color={theme.text.secondary} weight="bold" />
          </TouchableOpacity>
        </View>
      </View>
      <ConversationHistoryList
        ref={listRef}
        messages={messages}
        lastMessageId={lastMessageId}
        highlight={searchQuery}
        highlightIndex={anchorIndex}
        onMatchLayout={handleMatchLayout}
        onReady={handleReady}
        onStartReached={onStartReached}
        onEndReached={onEndReached}
        isFetchingOlder={isFetchingOlder}
        isFetchingNewer={isFetchingNewer}
        disableAutoAnchor
        onLayout={handleListLayout}
        contentContainerStyle={contentContainerStyle}
      />
    </>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    matchNavBar: {
      flexDirection: flexRow(),
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: theme.bg.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    matchNavCount: { color: theme.text.secondary, fontSize: font.sm, fontWeight: '600' },
    matchNavActions: { flexDirection: flexRow(), alignItems: 'center', gap: spacing.sm },
    matchNavBtn: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  })
}
