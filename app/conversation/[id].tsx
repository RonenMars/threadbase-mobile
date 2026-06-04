import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Share,
  ActivityIndicator,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Animated,
  type LayoutChangeEvent,
  type ListRenderItemInfo,
} from 'react-native'
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import { CaretDown, ExportIcon, InfoIcon } from 'phosphor-react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { MessageSkeletonRow } from '@/components/conversation/MessageSkeletonRow'
import { SlowLoadingBanner } from '@/components/conversation/SlowLoadingBanner'
import { useLoadingStateStore } from '@/stores/loading-state'
import { MessageBubble } from '@/components/conversation/MessageBubble'
import { ThinkingCard } from '@/components/conversation/ThinkingCard'
import { ToolCard } from '@/components/conversation/ToolCard'
import { DiffViewer } from '@/components/conversation/DiffViewer'
import { useConversation } from '@/hooks/useConversations'
import { useMinDisplayTime } from '@/hooks/useMinDisplayTime'
import { invalidateProjectChats } from '@/hooks/useProjectChats'
import { createApiForServer } from '@/services/api-client'
import { useServersStore } from '@/stores/servers'
import { useQueryClient } from '@tanstack/react-query'
import type { ResumeConversationResponse } from '@/types/projectChat'
import { dark, font, spacing } from '@/constants/theme'
import { InfoModal } from '@/components/shared/InfoModal'
import { ScreenHeader } from '@/components/shared/ScreenHeader'
import type { Message, MessageContent } from '@/types/api'
import { markNavigatedToSession } from '@/lib/sessionNavGuard'

const MESSAGE_SKELETON_KEYS = Array.from({ length: 10 }, (_, i) => `msg-sk-${i}`)


function renderContent(block: MessageContent, index: number, recycleKey: string) {
  if (block.type === 'thinking') {
    return <ThinkingCard key={index} block={block} recycleKey={recycleKey} />
  }
  if (block.type === 'tool_use' || block.type === 'tool_result') {
    return <ToolCard key={index} block={block} recycleKey={recycleKey} />
  }
  if (block.type === 'diff') {
    return <DiffViewer key={index} filename={block.filename} hunks={block.hunks} recycleKey={recycleKey} />
  }
  return null
}

// FlashList recycles cell instances, which would otherwise carry useState
// across messages (ToolCard / ThinkingCard / DiffViewer / MessageBubble each
// own `expanded` state). Threading the message id as `recycleKey` lets each
// child use `useRecyclingState` to reset its state when the cell is reassigned.
function MessageItem({ message, isLast }: { message: Message; isLast?: boolean }) {
  const { t } = useTranslation('conversation')
  const hasToolOrDiff = message.content.some(
    (b) => b.type === 'thinking' || b.type === 'tool_use' || b.type === 'tool_result' || b.type === 'diff'
  )
  // Bug 6 e2e: tag the final row so the Maestro flow can assert the last
  // message lands above (not behind) the Export + Resume action bar.
  const lastTestId = isLast ? 'conversation-last-message' : undefined

  if (hasToolOrDiff) {
    return (
      <View style={styles.toolContainer} testID={lastTestId}>
        {message.has_images ? (
          <Text style={styles.imageBadge}>{t('header.containsImage')}</Text>
        ) : null}
        {message.content.map((block, i) => {
          if (block.type === 'text') {
            if (!block.text.trim()) return null
            return (
              <MessageBubble
                key={i}
                message={{ ...message, content: [block] }}
                recycleKey={message.id}
              />
            )
          }
          return renderContent(block, i, message.id)
        })}
      </View>
    )
  }

  if (message.content.length === 0) return null
  return (
    <View testID={lastTestId}>
      {message.has_images ? (
        <Text style={styles.imageBadge}>{t('header.containsImage')}</Text>
      ) : null}
      <MessageBubble message={message} recycleKey={message.id} />
    </View>
  )
}

export default function ConversationDetailScreen() {
  const { t } = useTranslation(['conversation', 'common'])
  const { id, server } = useLocalSearchParams<{ id: string; server?: string }>()
  const router = useRouter()

  // Fall back to first server if no server param provided
  const fallbackServerId = useServersStore((s) => s.activeServerIds[0] ?? '')
  const serverId = server || fallbackServerId

  const {
    data: conversation,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    totalMessages,
    loadedMessages,
  } = useConversation(serverId, id)
  const listRef = useRef<FlashListRef<Message>>(null)
  const hasInitialScrolled = useRef(false)
  const userHasScrolled = useRef(false)
  const initialScrollSettleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevScrollY = useRef(0)
  const contentHeightRef = useRef(0)
  // Bug 10: hold the Top button visible for ~600ms after the last upward
  // scroll frame so single-pixel downward decel jitter doesn't flicker it.
  const lastUpwardAtRef = useRef(0)
  const scrollTopHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const [infoVisible, setInfoVisible] = useState(false)
  const [firstLayoutDone, setFirstLayoutDone] = useState(false)
  // Bug 6: measure the bottom action bar so the list's paddingBottom matches
  // its height. The outer SafeAreaView already reserves the bottom inset, so
  // we only feed bar height here (no additional safe-area math).
  const [footerHeight, setFooterHeight] = useState(0)
  const showSlowLoadingMsg = useLoadingStateStore((s) => s.slowCounts.messages > 0)
  // useState's lazy initializer creates the Animated.Value once at mount
  // without touching ref.current during render (which React 19 flags).
  const [pulseAnim] = useState(() => new Animated.Value(1))

  // Skeleton stays up until the network fetch lands AND the FlashList has
  // stopped resizing (handleContentSizeChange settles). The 800 ms
  // useMinDisplayTime floor below is the anti-flicker mechanism from bug-1.
  const isReady = conversation !== undefined && firstLayoutDone
  const isGated = useMinDisplayTime(isReady, 800, id)

  useEffect(() => {
    hasInitialScrolled.current = false
    userHasScrolled.current = false
    queueMicrotask(() => setFirstLayoutDone(false))
    if (initialScrollSettleRef.current) {
      clearTimeout(initialScrollSettleRef.current)
      initialScrollSettleRef.current = null
    }
    if (scrollTopHideTimerRef.current) {
      clearTimeout(scrollTopHideTimerRef.current)
      scrollTopHideTimerRef.current = null
    }
    lastUpwardAtRef.current = 0
  }, [id])

  // Clean up the Bug 10 hide timer on unmount so we don't fire a setState
  // after the screen has been popped from the stack.
  useEffect(() => {
    return () => {
      if (scrollTopHideTimerRef.current) {
        clearTimeout(scrollTopHideTimerRef.current)
        scrollTopHideTimerRef.current = null
      }
    }
  }, [])

  // Empty conversations may never fire onContentSizeChange — flip immediately
  // so we don't sit under a skeleton for an empty state.
  useEffect(() => {
    if (conversation && conversation.messages.length === 0) {
      queueMicrotask(() => setFirstLayoutDone(true))
    }
  }, [conversation])

  const scrollToBottom = useCallback((animated: boolean) => {
    listRef.current?.scrollToEnd({ animated })
  }, [])

  // Keep re-pinning to the bottom every time content grows, until the user
  // actually drags. scrollToEnd targets the current bottom and the bottom
  // keeps moving as lazy rows / tool cards / images finish laying out. After
  // 150ms of no size changes we treat the initial scroll as "settled" and
  // flip `firstLayoutDone` so the Bug-1 skeleton overlay lifts — but we keep
  // auto-anchoring to the bottom for any late layout deltas, so the list
  // doesn't sit parked above the true end.
  const handleContentSizeChange = useCallback((_w: number, h: number) => {
    contentHeightRef.current = h
    if (userHasScrolled.current) return
    scrollToBottom(false)
    if (initialScrollSettleRef.current) clearTimeout(initialScrollSettleRef.current)
    initialScrollSettleRef.current = setTimeout(() => {
      scrollToBottom(true)
      hasInitialScrolled.current = true
      initialScrollSettleRef.current = null
      setFirstLayoutDone(true)
    }, 150)
  }, [scrollToBottom])

  // User touched the list — stop the auto-scroll loop immediately.
  const handleScrollBeginDrag = useCallback(() => {
    hasInitialScrolled.current = true
    userHasScrolled.current = true
    if (initialScrollSettleRef.current) {
      clearTimeout(initialScrollSettleRef.current)
      initialScrollSettleRef.current = null
    }
  }, [])

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
    const y = contentOffset.y
    const scrollingUp = y < prevScrollY.current
    prevScrollY.current = y

    // Bug 10: keep the Top button visible for ~600ms after the most recent
    // upward frame, so decel jitter doesn't flicker it off mid-gesture.
    // Also suppress when near the top (no point offering "scroll to top").
    const HOLD_MS = 600
    if (scrollingUp) lastUpwardAtRef.current = Date.now()
    const sinceUpward = Date.now() - lastUpwardAtRef.current
    const shouldShowTop = sinceUpward < HOLD_MS && y > 100 && y >= 200
    setShowScrollTop(shouldShowTop)
    if (scrollTopHideTimerRef.current) {
      clearTimeout(scrollTopHideTimerRef.current)
      scrollTopHideTimerRef.current = null
    }
    if (shouldShowTop) {
      // Re-evaluate visibility once the hold window expires so the button
      // hides even without another scroll event.
      scrollTopHideTimerRef.current = setTimeout(() => {
        setShowScrollTop(false)
        scrollTopHideTimerRef.current = null
      }, HOLD_MS - sinceUpward)
    }

    const distFromBottom = contentSize.height - y - layoutMeasurement.height
    setShowScrollBottom(distFromBottom > 100)

    // Only backfill older pages when the user has actively scrolled into the
    // top region of a list that is *also* not at its bottom — guards against
    // short pages where the natural resting y is < 200 and would otherwise
    // auto-trigger backfill from the bottom on mount.
    const nearTop = y < 200
    const nearBottom = distFromBottom < 200
    if (
      userHasScrolled.current &&
      nearTop &&
      !nearBottom &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      void fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const queryClient = useQueryClient()

  const resumeSession = useMutation({
    mutationFn: async (): Promise<{ sessionId: string; projectId?: string; projectPath?: string | null; conversationId: string }> => {
      const api = createApiForServer(serverId)
      // Backend may return either the modern ResumeConversationResponse or the
      // legacy `{ id }` shape during migration — normalise here.
      const resp = await api.post<ResumeConversationResponse | { id: string }>(
        '/api/sessions/resume',
        { sessionId: id },
      )
      if ('sessionId' in resp) {
        return {
          sessionId: resp.sessionId,
          projectId: resp.projectId,
          projectPath: resp.projectPath,
          conversationId: resp.conversationId,
        }
      }
      return { sessionId: resp.id, projectPath: conversation?.projectPath, conversationId: id }
    },
    onSuccess: async (result) => {
      // Invalidate the unified ProjectChat list so the resumed conversation
      // is replaced by the new session (backend dedupes; UI also dedupes
      // defensively in useProjectChats).
      invalidateProjectChats(queryClient, serverId)
      const params = new URLSearchParams({ server: serverId })
      if (result.projectId) params.set('projectId', result.projectId)
      if (result.projectPath) params.set('projectPath', result.projectPath)
      params.set('resumedFromConversationId', result.conversationId)
      markNavigatedToSession(result.sessionId)
      router.push(`/session/${result.sessionId}?${params.toString()}`)
    },
  })

  useEffect(() => {
    if (!resumeSession.isPending) {
      pulseAnim.setValue(1)
      return
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.45, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [resumeSession.isPending, pulseAnim])

  const handleShare = useCallback(async () => {
    if (!conversation) return
    const md = conversation.messages
      .map((m) => {
        const role = m.role === 'user' ? '**User**' : '**Assistant**'
        const text = m.content
          .filter((b) => b.type === 'text')
          .map((b) => (b as { text: string }).text)
          .join('\n')
        return `${role}\n\n${text}`
      })
      .join('\n\n---\n\n')
    await Share.share({ message: md })
  }, [conversation])

  const renderItem = useCallback(({ item, index }: { item: Message; index: number }) => (
    <MessageItem
      message={item}
      isLast={index === (conversation?.messages.length ?? 0) - 1}
    />
  ), [conversation?.messages.length])

  const handleFooterLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height
    setFooterHeight((prev) => (Math.abs(prev - h) > 0.5 ? h : prev))
  }, [])

  const listContentStyle = useMemo(
    () => [styles.listContent, { paddingBottom: footerHeight + spacing.lg }],
    [footerHeight],
  )

  // Distinguish row shapes so FlashList only recycles cells of the same kind.
  // Without this, a recycled cell from a tool-card row can leak its previous
  // content under a new text-bubble row, causing visible overlap during scroll.
  const getItemType = useCallback((item: Message) => {
    const hasToolOrDiff = item.content.some(
      (b) => b.type === 'thinking' || b.type === 'tool_use' || b.type === 'tool_result' || b.type === 'diff'
    )
    if (hasToolOrDiff) return 'tool'
    return item.role === 'user' ? 'user' : 'assistant'
  }, [])

  const renderSkeletonItem = useCallback(({ index }: ListRenderItemInfo<string>) => (
    <MessageSkeletonRow index={index} />
  ), [])

  const infoButton = (
    <Pressable
      onPress={() => setInfoVisible(true)}
      hitSlop={8}
      accessibilityLabel="Conversation info"
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
    >
      <InfoIcon size={22} color={dark.text.secondary} />
    </Pressable>
  )

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScreenHeader right={infoButton} />
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>{t('error.loadFailed')}</Text>
          <Text style={styles.errorMessage}>{error.message}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>{t('common:button.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // Cold load (no cached data yet) — render skeleton-only screen; gate handles the rest below.
  if (isLoading && !conversation) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScreenHeader right={infoButton} />
        <View style={styles.listWrapper}>
          <FlatList
            data={MESSAGE_SKELETON_KEYS}
            keyExtractor={(k) => k}
            renderItem={renderSkeletonItem}
            contentContainerStyle={styles.listContent}
          />
          {showSlowLoadingMsg ? <SlowLoadingBanner onAbort={() => router.back()} /> : null}
        </View>
      </SafeAreaView>
    )
  }

  if (!conversation) return null

  const hasMessages = conversation.messages.length > 0
  const isLoadingMessages = Boolean(hasNextPage || isFetchingNextPage)

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title={conversation.title} right={infoButton} />
      <View style={styles.inner}>
      {isGated ? (
        <View style={styles.skeletonOverlay} pointerEvents="none">
          <FlatList
            data={MESSAGE_SKELETON_KEYS}
            keyExtractor={(k) => k}
            renderItem={renderSkeletonItem}
            contentContainerStyle={styles.listContent}
            scrollEnabled={false}
          />
          {showSlowLoadingMsg ? <SlowLoadingBanner onAbort={() => router.back()} /> : null}
        </View>
      ) : null}
      {isLoadingMessages && totalMessages > 0 ? (
        <ProgressBar
          loaded={loadedMessages}
          total={totalMessages}
          label="messages"
        />
      ) : null}
      {hasMessages ? (
        <View style={styles.listWrapper}>
          <FlashList
            ref={listRef}
            data={conversation.messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            getItemType={getItemType}
            contentContainerStyle={listContentStyle}
            onContentSizeChange={handleContentSizeChange}
            onScroll={handleScroll}
            onScrollBeginDrag={handleScrollBeginDrag}
            scrollEventThrottle={100}
            maintainVisibleContentPosition={{
              autoscrollToBottomThreshold: 0.2,
              startRenderingFromBottom: true,
            }}
            ListHeaderComponent={
              isFetchingNextPage ? (
                <View style={styles.headerLoading}>
                  <ActivityIndicator color={dark.text.secondary} />
                </View>
              ) : null
            }
          />
          {showScrollTop ? (
            <TouchableOpacity
              style={[styles.scrollBtn, styles.scrollBtnTop]}
              onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
              accessibilityLabel="Scroll to top"
            >
              <Text style={styles.scrollBtnText}>{t('common:nav.top')}</Text>
            </TouchableOpacity>
          ) : null}
          {showScrollBottom ? (
            <TouchableOpacity
              style={styles.scrollBtnBottom}
              onPress={() => scrollToBottom(true)}
              accessibilityLabel={t('action.scrollToBottom')}
              accessibilityRole="button"
              activeOpacity={0.75}
            >
              <CaretDown size={20} color="#fff" weight="bold" />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{t('list.empty')}</Text>
        </View>
      )}

      <View style={styles.footer} onLayout={handleFooterLayout} testID="conversation-bottom-bar">
        <View style={styles.resumeWrapper}>
          {resumeSession.isError ? (
            <Text style={styles.resumeError} numberOfLines={2}>
              {resumeSession.error instanceof Error
                ? resumeSession.error.message
                : 'Failed to resume'}
            </Text>
          ) : null}
          <TouchableOpacity
            style={styles.resumeBtn}
            onPress={() => resumeSession.mutate()}
            disabled={resumeSession.isPending}
          >
            <Animated.Text style={[styles.resumeBtnText, { opacity: pulseAnim }]}>
              {resumeSession.isPending ? 'Starting...' : '▶ Resume Session'}
            </Animated.Text>
          </TouchableOpacity>
        </View>
      </View>

      </View>

      <InfoModal
        visible={infoVisible}
        onClose={() => setInfoVisible(false)}
        title="Conversation Info"
        action={{
          icon: ExportIcon,
          accessibilityLabel: t('action.export'),
          onPress: handleShare,
          testID: 'export-action',
        }}
        fields={[
          { label: 'ID', value: conversation.id },
          { label: 'Title', value: conversation.title },
          { label: 'Session Name', value: conversation.sessionName },
          { label: 'Project Path', value: conversation.projectPath },
          { label: 'File Path', value: conversation.filePath },
          { label: 'Branch', value: conversation.branch },
          { label: 'Account', value: conversation.account },
          { label: 'Model', value: conversation.model },
          { label: 'Message Count', value: String(conversation.messageCount) },
          { label: 'Total Tokens', value: conversation.totalTokens != null ? String(conversation.totalTokens) : undefined },
          { label: 'Last Activity', value: conversation.lastActivity },
        ]}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dark.bg.primary },
  inner: { flex: 1 },
  skeletonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: dark.bg.primary,
    zIndex: 10,
  },
  listWrapper: { flex: 1 },
  listContent: { paddingTop: spacing.md, paddingBottom: spacing.lg },
  headerLoading: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBtn: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: dark.text.accent,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  scrollBtnTop: { top: spacing.md },
  // Bug 11: circular FAB-style bottom-right button. Sits inside the
  // listWrapper, which ends at the top of the footer bar, so `spacing.md`
  // already clears the Resume Session row.
  scrollBtnBottom: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: dark.text.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  scrollBtnText: { color: '#fff', fontSize: font.sm, fontWeight: '600' },
  toolContainer: { paddingHorizontal: spacing.md, gap: spacing.xs, marginVertical: spacing.xs },
  imageBadge: { color: dark.text.secondary, fontSize: font.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: dark.border,
  },
  resumeWrapper: {
    flex: 1,
    gap: spacing.xs,
  },
  resumeError: {
    color: '#ef4444',
    fontSize: font.xs,
    textAlign: 'center',
  },
  resumeBtn: {
    backgroundColor: dark.text.accent,
    borderRadius: 10,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resumeBtnDisabled: { opacity: 0.5 },
  resumeBtnText: { color: '#fff', fontWeight: '700', fontSize: font.base },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  errorTitle: { color: dark.text.primary, fontSize: font.base, fontWeight: '600' },
  errorMessage: { color: dark.text.secondary, fontSize: font.sm, textAlign: 'center' },
  emptyText: { color: dark.text.secondary, fontSize: font.sm },
  retryBtn: {
    marginTop: spacing.md,
    backgroundColor: dark.bg.card,
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryBtnText: { color: dark.text.primary, fontSize: font.base },
})
