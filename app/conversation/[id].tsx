import React, { useCallback, useEffect, useRef, useState } from 'react'
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
  type ListRenderItemInfo,
} from 'react-native'
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import { InfoIcon } from 'phosphor-react-native'
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

const MESSAGE_SKELETON_KEYS = Array.from({ length: 10 }, (_, i) => `msg-sk-${i}`)


function renderContent(block: MessageContent, index: number) {
  if (block.type === 'thinking') {
    return <ThinkingCard key={index} block={block} />
  }
  if (block.type === 'tool_use' || block.type === 'tool_result') {
    return <ToolCard key={index} block={block} />
  }
  if (block.type === 'diff') {
    return <DiffViewer key={index} filename={block.filename} hunks={block.hunks} />
  }
  return null
}

function MessageItemInner({ message }: { message: Message }) {
  const hasToolOrDiff = message.content.some(
    (b) => b.type === 'thinking' || b.type === 'tool_use' || b.type === 'tool_result' || b.type === 'diff'
  )

  if (hasToolOrDiff) {
    return (
      <View style={styles.toolContainer}>
        {message.has_images ? (
          <Text style={styles.imageBadge}>📎 Contains image</Text>
        ) : null}
        {message.content.map((block, i) => {
          if (block.type === 'text') {
            if (!block.text.trim()) return null
            return <MessageBubble key={i} message={{ ...message, content: [block] }} />
          }
          return renderContent(block, i)
        })}
      </View>
    )
  }

  if (message.content.length === 0) return null
  return (
    <View>
      {message.has_images ? (
        <Text style={styles.imageBadge}>📎 Contains image</Text>
      ) : null}
      <MessageBubble message={message} />
    </View>
  )
}

// FlashList recycles cell instances. Without a per-message key on the inner
// subtree, child useState (ToolCard.expanded, MessageBubble.TextBlockBody
// expanded, ThinkingCard.expanded, DiffViewer.expanded) carries from the
// previous message into the new one — producing visual overlap during scroll.
// Keying the inner tree by message id forces React to remount when the cell
// is reassigned, dropping the stale state.
function MessageItem({ message }: { message: Message }) {
  return <MessageItemInner key={message.id} message={message} />
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
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const [infoVisible, setInfoVisible] = useState(false)
  const [firstLayoutDone, setFirstLayoutDone] = useState(false)
  const showSlowLoadingMsg = useLoadingStateStore((s) => s.slowCounts.messages > 0)
  const pulseAnim = useRef(new Animated.Value(1)).current

  // Two-phase skeleton timing:
  //  Phase 1: 0.8s floor before treating the screen as ready
  //  Phase 2: +0.8s buffer after the auto-scroll settles, so the final scroll
  //           lands fully behind the skeleton before it lifts
  const [postScrollDelayDone, setPostScrollDelayDone] = useState(false)
  const isReady = conversation !== undefined && firstLayoutDone && postScrollDelayDone
  const isGated = useMinDisplayTime(isReady, 800, id)

  useEffect(() => {
    hasInitialScrolled.current = false
    userHasScrolled.current = false
    setFirstLayoutDone(false)
    setPostScrollDelayDone(false)
    if (initialScrollSettleRef.current) {
      clearTimeout(initialScrollSettleRef.current)
      initialScrollSettleRef.current = null
    }
  }, [id])

  // Phase-2 buffer: hold the skeleton 0.8s after the scroll settles.
  useEffect(() => {
    if (!firstLayoutDone) return
    const t = setTimeout(() => setPostScrollDelayDone(true), 800)
    return () => clearTimeout(t)
  }, [firstLayoutDone])

  // Empty conversations may never fire onContentSizeChange — flip immediately
  // so we don't sit under a skeleton for an empty state.
  useEffect(() => {
    if (conversation && conversation.messages.length === 0) {
      setFirstLayoutDone(true)
    }
  }, [conversation])

  const scrollToBottom = useCallback((animated: boolean) => {
    listRef.current?.scrollToEnd({ animated })
  }, [])

  // Keep re-pinning to the bottom every time content grows, until the user
  // actually drags. scrollToEnd targets the current bottom and the bottom
  // keeps moving as lazy rows / tool cards / images finish laying out. After
  // 400ms of no size changes we treat the initial scroll as "settled" and
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
    }, 400)
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
    setShowScrollTop(scrollingUp && y > 100)
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

  const renderItem = useCallback(({ item }: { item: Message }) => (
    <MessageItem message={item} />
  ), [])

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
            contentContainerStyle={styles.listContent}
            onContentSizeChange={handleContentSizeChange}
            onScroll={handleScroll}
            onScrollBeginDrag={handleScrollBeginDrag}
            scrollEventThrottle={100}
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
              style={[styles.scrollBtn, styles.scrollBtnBottom]}
              onPress={() => scrollToBottom(true)}
              accessibilityLabel="Scroll to bottom"
            >
              <Text style={styles.scrollBtnText}>{t('common:nav.bottom')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{t('list.empty')}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Text style={styles.shareBtnText}>{t('action.export')}</Text>
        </TouchableOpacity>
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
  scrollBtnBottom: { bottom: spacing.md },
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
  shareBtn: {
    backgroundColor: dark.bg.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: dark.border,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtnText: { color: dark.text.primary, fontSize: font.base },
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
