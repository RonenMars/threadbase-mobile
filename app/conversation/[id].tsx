import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Share,
  Alert,
  ActivityIndicator,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Animated,
  type LayoutChangeEvent,
  type ListRenderItemInfo,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import { CaretDown, ExportIcon, InfoIcon, Star } from 'phosphor-react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { MessageSkeletonRow } from '@/components/conversation/MessageSkeletonRow'
import { SlowLoadingBanner } from '@/components/conversation/SlowLoadingBanner'
import { useLoadingStateStore } from '@/stores/loading-state'
import { MessageItem } from '@/components/conversation/MessageItem'
import { useConversation } from '@/hooks/useConversations'
import { useMinDisplayTime } from '@/hooks/useMinDisplayTime'
import { createApiForServer, NotFoundError } from '@/services/api-client'
import { useServersStore } from '@/stores/servers'
import { useQueryClient } from '@tanstack/react-query'
import type { ResumeConversationResponse } from '@/types/projectChat'
import { brand, font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { InfoModal } from '@/components/shared/InfoModal'
import { ScreenHeader } from '@/components/shared/ScreenHeader'
import type { Message, Session } from '@/types/api'
import { normalizeResumeResponse } from '@/utils/normalizeResumeResponse'
import { markNavigatedToSession } from '@/lib/sessionNavGuard'
import { useQuickAccessStore, buildFavoriteId, QUICK_ACCESS_STORAGE_KEY } from '@/stores/quickAccess'

const MESSAGE_SKELETON_KEYS = Array.from({ length: 10 }, (_, i) => `msg-sk-${i}`)



export default function ConversationDetailScreen() {
  const { t } = useTranslation(['conversation', 'common'])
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(theme, insets.bottom), [theme, insets.bottom])
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

  const isConvNotFound = error instanceof NotFoundError
  // ponytail: only fires when conversation 404s — avoids extra request on normal loads
  const { data: liveSession, isLoading: isSessionLoading } = useQuery({
    queryKey: ['session', serverId, id],
    queryFn: () => createApiForServer(serverId).get<Session>(`/api/sessions/${id}`),
    enabled: isConvNotFound,
    retry: false,
    meta: { persist: false },
  })

  // Only redirect to the live session view when the session is actually
  // attached. An idle, detached session bounces straight back here
  // (session/[id] redirects ptyAttached===false && idle sessions to
  // /conversation/:id), so redirecting on mere existence is an infinite loop.
  const isSessionLive = liveSession?.ptyAttached === true
  useEffect(() => {
    if (isConvNotFound && isSessionLive) {
      router.replace(`/session/${id}?server=${serverId}`)
    }
  }, [isConvNotFound, isSessionLive, id, serverId, router])
  const listRef = useRef<FlashListRef<Message>>(null)
  const hasInitialScrolled = useRef(false)
  const userHasScrolled = useRef(false)
  const initialScrollSettleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Hard ceiling on how long the skeleton may wait for layout to settle —
  // code/image-heavy pages keep resizing and would otherwise reset the settle
  // debounce indefinitely. Starts at the first onContentSizeChange.
  const firstLayoutCapRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
  const favoriteId = buildFavoriteId(serverId, 'conversation', id)
  const isFavorite = useQuickAccessStore((s) => s.favorites.some((f) => f.id === favoriteId))
  const [starScale] = useState(() => new Animated.Value(1))
  // Bug 6: measure the bottom action bar so the list's paddingBottom matches
  // its height. The outer SafeAreaView already reserves the bottom inset, so
  // we only feed bar height here (no additional safe-area math).
  const [footerHeight, setFooterHeight] = useState(0)
  const showSlowLoadingMsg = useLoadingStateStore((s) => s.slowCounts.messages > 0)
  // useState's lazy initializer creates the Animated.Value once at mount
  // without touching ref.current during render (which React 19 flags).
  const [pulseAnim] = useState(() => new Animated.Value(1))
  const [glowOpacity] = useState(() => new Animated.Value(0))
  const [glowScale] = useState(() => new Animated.Value(0.85))
  const animateStar = useCallback(() => {
    starScale.stopAnimation()
    starScale.setValue(1)
    glowOpacity.stopAnimation()
    glowScale.stopAnimation()
    glowOpacity.setValue(0)
    glowScale.setValue(0.85)
    Animated.sequence([
      Animated.spring(starScale, { toValue: 1.14, useNativeDriver: true, friction: 8, tension: 130 }),
      Animated.spring(starScale, { toValue: 1, useNativeDriver: true, friction: 7, tension: 110 }),
    ]).start()
    Animated.sequence([
      Animated.timing(glowOpacity, { toValue: 0.28, duration: 110, useNativeDriver: true }),
      Animated.timing(glowOpacity, { toValue: 0, duration: 190, useNativeDriver: true }),
    ]).start()
    Animated.sequence([
      Animated.timing(glowScale, { toValue: 1.05, duration: 110, useNativeDriver: true }),
      Animated.timing(glowScale, { toValue: 1.2, duration: 190, useNativeDriver: true }),
    ]).start()
  }, [starScale, glowOpacity, glowScale])

  const toggleFavorite = useCallback(async () => {
    const previousFavorites = useQuickAccessStore.getState().favorites
    const nextFavorites = isFavorite
      ? previousFavorites.filter((f) => f.id !== favoriteId)
      : [...previousFavorites, {
          type: 'conversation' as const,
          id: favoriteId,
          label: conversation?.title || conversation?.projectPath || id || '',
          serverId,
          conversationId: id,
        }]

    useQuickAccessStore.setState({ favorites: nextFavorites })
    try {
      await AsyncStorage.setItem(
        QUICK_ACCESS_STORAGE_KEY,
        JSON.stringify({
          ...useQuickAccessStore.getState(),
          favorites: nextFavorites,
        }),
      )
      animateStar()
    } catch (err) {
      useQuickAccessStore.setState({ favorites: previousFavorites })
      Alert.alert('Favorites error', err instanceof Error ? err.message : 'Failed to update favorites')
    }
  }, [animateStar, conversation?.projectPath, conversation?.title, favoriteId, id, isFavorite, serverId])

  // Skeleton stays up until the network fetch lands AND the FlashList has
  // had a beat to lay out (handleContentSizeChange settles or hits its cap).
  // The 400 ms useMinDisplayTime floor below is the anti-flicker mechanism
  // from bug-1 — just enough to avoid a skeleton flash on fast loads.
  const isReady = conversation !== undefined && firstLayoutDone
  const isGated = useMinDisplayTime(isReady, 400, id)

  useEffect(() => {
    hasInitialScrolled.current = false
    userHasScrolled.current = false
    queueMicrotask(() => setFirstLayoutDone(false))
    if (initialScrollSettleRef.current) {
      clearTimeout(initialScrollSettleRef.current)
      initialScrollSettleRef.current = null
    }
    if (firstLayoutCapRef.current) {
      clearTimeout(firstLayoutCapRef.current)
      firstLayoutCapRef.current = null
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
      if (firstLayoutCapRef.current) {
        clearTimeout(firstLayoutCapRef.current)
        firstLayoutCapRef.current = null
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
  // flip `firstLayoutDone` so the Bug-1 skeleton overlay lifts. Heavy pages
  // (code blocks, images) can keep resizing and resetting that debounce, so
  // a one-shot cap started at the FIRST size change flips `firstLayoutDone`
  // after 500ms no matter what — the list may keep settling to the bottom
  // visibly, but the skeleton must not wait for layout to fully quiesce.
  //
  // Bug 17: once the initial scroll has settled, stop firing per-chunk
  // scrollToEnd calls. FlashList's `maintainVisibleContentPosition`
  // (`autoscrollToBottomThreshold: 0.2`) anchors the bottom natively as
  // content grows during streaming or pagination, so JS-side scroll calls
  // here just stack and produce visible jumps.
  const handleContentSizeChange = useCallback((_w: number, h: number) => {
    contentHeightRef.current = h
    if (userHasScrolled.current) return
    if (hasInitialScrolled.current) return
    scrollToBottom(false)
    if (!firstLayoutCapRef.current) {
      firstLayoutCapRef.current = setTimeout(() => {
        firstLayoutCapRef.current = null
        setFirstLayoutDone(true)
      }, 500)
    }
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
    mutationFn: async (): Promise<{ sessionId: string; projectId?: string; projectPath?: string | null; conversationId: string; sessionSnapshot: Session | null }> => {
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
          sessionSnapshot: normalizeResumeResponse(resp),
        }
      }
      return { sessionId: resp.id, projectPath: conversation?.projectPath, conversationId: id, sessionSnapshot: null }
    },
    onSuccess: async (result) => {
      // Seed the session detail cache so the session screen renders immediately
      // without a GET /api/sessions/:id round-trip.
      if (result.sessionSnapshot) {
        queryClient.setQueryData(['session', serverId, result.sessionId], result.sessionSnapshot)
      }
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

  // Key the callback on the last message's id, not the count: older pages
  // prepend, so the id only changes when the tail actually changes and rows
  // don't all receive a new render function on every fetch.
  const lastMessageId = conversation?.messages[conversation.messages.length - 1]?.id
  const renderItem = useCallback(({ item }: { item: Message }) => (
    <MessageItem
      message={item}
      isLast={item.id === lastMessageId}
    />
  ), [lastMessageId])

  const handleFooterLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height
    setFooterHeight((prev) => (Math.abs(prev - h) > 0.5 ? h : prev))
  }, [])

  const listContentStyle = useMemo(
    () => [styles.listContent, { paddingBottom: footerHeight + spacing.lg }],
    [footerHeight, styles],
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

  const headerActions = (
    <View style={styles.headerActions}>
      <Pressable
        onPress={() => { void toggleFavorite() }}
        hitSlop={8}
        accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
      >
        <Animated.View style={{ transform: [{ scale: starScale }], position: 'relative' }}>
          <Animated.View style={{ transform: [{ scale: glowScale }], opacity: glowOpacity, position: 'absolute', top: -6, right: -6, bottom: -6, left: -6 }}>
            <Star size={28} color={theme.text.accent} weight="fill" />
          </Animated.View>
          <Star size={22} color={isFavorite ? theme.text.accent : theme.text.secondary} weight={isFavorite ? 'fill' : 'regular'} />
        </Animated.View>
      </Pressable>
      <Pressable
        onPress={() => setInfoVisible(true)}
        hitSlop={8}
        accessibilityLabel="Conversation info"
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
      >
        <InfoIcon size={22} color={theme.text.secondary} />
      </Pressable>
    </View>
  )

  if (error) {
    // A 404 from /api/conversations/:id doesn't mean "gone" — it may mean the
    // session is live but hasn't written JSONL yet. Check /api/sessions/:id;
    // if found, redirect to the live session view (handled by the useEffect above).
    // While that check is in-flight, show a spinner. Only show "no longer available"
    // once we've confirmed the session is also absent.
    if (isConvNotFound && isSessionLoading) {
      return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <ScreenHeader right={headerActions} />
          <View style={styles.centered}>
            <ActivityIndicator color={theme.text.secondary} />
          </View>
        </SafeAreaView>
      )
    }
    // Other errors (timeout, network) are transient: keep Retry.
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScreenHeader right={headerActions} />
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>{t('error.loadFailed')}</Text>
          <Text style={styles.errorMessage}>
            {isConvNotFound ? t('error.notFound') : error.message}
          </Text>
          {isConvNotFound ? null : (
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryBtnText}>{t('common:button.retry')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    )
  }

  // Cold load (no cached data yet) — render skeleton-only screen; gate handles the rest below.
  if (isLoading && !conversation) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScreenHeader right={headerActions} />
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

  // `resumable` is absent on older servers — treat undefined as resumable.
  // When false, the project the session ran in is gone: show the history
  // read-only with a banner explaining why, and disable Resume.
  // codex-cli conversations are never resumable (Phase 2).
  const isCodex = conversation.provider === 'codex-cli'
  const providerColor = isCodex ? brand.codex : brand.claude
  const providerDot = <View style={[styles.providerDot, { backgroundColor: providerColor }]} />
  const notResumable = isCodex || conversation.resumable === false
  const unavailableMessage = notResumable
    ? isCodex
      ? t('unavailable.cannotResume')
      : conversation.unavailableReason === 'worktree_removed'
        ? t('unavailable.worktreeRemoved')
        : t('unavailable.pathMissing')
    : null

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title={conversation.title} titleRight={providerDot} right={headerActions} />
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
      {unavailableMessage ? (
        <View style={styles.unavailableBanner}>
          <Text style={styles.unavailableBannerText}>{unavailableMessage}</Text>
        </View>
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
                  <ActivityIndicator color={theme.text.secondary} />
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
            style={[styles.resumeBtn, notResumable && styles.resumeBtnDisabled]}
            onPress={() => resumeSession.mutate()}
            disabled={resumeSession.isPending || notResumable}
          >
            <Animated.Text
              style={[styles.resumeBtnText, { opacity: notResumable ? 1 : pulseAnim }]}
            >
              {notResumable
                ? t('unavailable.cannotResume')
                : resumeSession.isPending
                  ? 'Starting...'
                  : '▶ Resume Session'}
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
          { label: 'Provider', value: conversation.provider ?? 'claude-code' },
          { label: 'Model', value: conversation.model },
          { label: 'Message Count', value: String(conversation.messageCount) },
          { label: 'Total Tokens', value: conversation.totalTokens != null ? String(conversation.totalTokens) : undefined },
          { label: 'Last Activity', value: conversation.lastActivity },
        ]}
      />
    </SafeAreaView>
  )
}

function makeStyles(theme: Theme, bottomInset: number = 0) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg.primary },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    providerDot: { width: 8, height: 8, borderRadius: 4 },
    inner: { flex: 1 },
    skeletonOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.bg.primary,
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
      backgroundColor: theme.text.accent,
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
    toolContainer: { paddingHorizontal: spacing.md, gap: spacing.xs, marginVertical: spacing.xs },
    imageBadge: { color: theme.text.secondary, fontSize: font.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
    footer: {
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.md,
      paddingBottom: spacing.md + bottomInset,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    unavailableBanner: {
      backgroundColor: theme.bg.card,
      borderLeftWidth: 3,
      borderLeftColor: '#f59e0b',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    unavailableBannerText: {
      color: theme.text.secondary,
      fontSize: font.sm,
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
      backgroundColor: theme.text.accent,
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
    errorTitle: { color: theme.text.primary, fontSize: font.base, fontWeight: '600' },
    errorMessage: { color: theme.text.secondary, fontSize: font.sm, textAlign: 'center' },
    emptyText: { color: theme.text.secondary, fontSize: font.sm },
    retryBtn: {
      marginTop: spacing.md,
      backgroundColor: theme.bg.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: spacing.lg,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    retryBtnText: { color: theme.text.primary, fontSize: font.base },
  })
}
