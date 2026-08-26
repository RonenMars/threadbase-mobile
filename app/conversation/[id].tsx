import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Share,
  Alert,
  ActivityIndicator,
  FlatList,
  Animated,
  AppState,
  type LayoutChangeEvent,
  type ListRenderItemInfo,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ExportIcon, InfoIcon, MagnifyingGlass, Play, ArrowLeft, Star } from 'phosphor-react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { MessageSkeletonRow } from '@/components/conversation/MessageSkeletonRow'
import { SlowLoadingBanner } from '@/components/conversation/SlowLoadingBanner'
import { ConversationHistoryList } from '@/components/conversation/ConversationHistoryList'
import { ConversationSearchView } from '@/components/conversation/ConversationSearchView'
import { useLoadingStateStore } from '@/stores/loading-state'
import { useNavLockStore } from '@/stores/navLock'
import { useConversation } from '@/hooks/useConversations'
import { useConversationStream } from '@/hooks/useConversationStream'
import { useMinDisplayTime } from '@/hooks/useMinDisplayTime'
import { createApiForServer, ConversationBusyError, NotFoundError } from '@/services/api-client'
import { CODEX_CLI_PROVIDER } from '@/constants/providers'
import { wsManager } from '@/services/ws-client'
import { mergeLiveMessages } from '@/utils/mergeLiveMessages'
import { evictStaleConversationFavorite } from '@/lib/sessionLifecycle'
import { startOpenTrace, mark as traceMark, finishOpenTrace, useLiveInstanceCount } from '@/lib/openTrace'
import { markNavigatedToSession } from '@/lib/sessionNavGuard'
import { useSessionActions, type ResumeResult } from '@/hooks/useSessionActions'
import { useServersStore } from '@/stores/servers'
import { brand, font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useAppDirection } from '@/lib/rtl'
import { InfoModal } from '@/components/shared/InfoModal'
import { LivePauseControl } from '@/components/conversation/LivePauseControl'
import { makeStyles as makeSearchStyles } from '@/components/sessions/SearchStyles'
import { ScreenHeader } from '@/components/shared/ScreenHeader'
import type { Message, Session } from '@/types/api'
import { useQuickAccessStore, buildFavoriteId, QUICK_ACCESS_STORAGE_KEY } from '@/stores/quickAccess'

const MESSAGE_SKELETON_KEYS = Array.from({ length: 10 }, (_, i) => `msg-sk-${i}`)

// Cadence for the focus-scoped freshness poll (P2.1). The detail endpoint is
// stale-while-revalidate (~2s) and the drain self-throttles (5s canTrigger), so
// a 3s tick converges without a ?refresh=1 or over-fetching.
const LIVE_POLL_INTERVAL_MS = 3000

function getResumeReasonLabel(reason: string, t: TFunction<['conversation', 'common']>): string {
  switch (reason) {
    case 'file_handle':
      return t('conversation:resume.reason.file_handle')
    case 'jsonl_mtime':
      return t('conversation:resume.reason.jsonl_mtime')
    case 'process_argv':
      return t('conversation:resume.reason.process_argv')
    case 'process_cwd':
      return t('conversation:resume.reason.process_cwd')
    default:
      return t('conversation:resume.reason.unknown')
  }
}

interface SearchTargetResponse {
  query: string
  message_index: number
  uuid: string | null
  snippet: string
  match_indexes: number[]
  total_matches: number
}

export default function ConversationDetailScreen() {
  useLiveInstanceCount('ConversationDetail')
  const { t } = useTranslation(['conversation', 'common'])
  const theme = useTheme()
  const { direction } = useAppDirection()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const searchStyles = useMemo(() => makeSearchStyles(theme, direction), [theme, direction])
  const { id, server, search, anchor_index, fromSession: fromSessionParam, openSearch: openSearchParam } = useLocalSearchParams<{
    id: string
    server?: string
    search?: string
    anchor_index?: string
    fromSession?: string
    openSearch?: string
  }>()
  const router = useRouter()

  // Fall back to first server if no server param provided
  const fallbackServerId = useServersStore((s) => s.activeServerIds[0] ?? '')
  const serverId = server || fallbackServerId
  const fromSession =
    typeof fromSessionParam === 'string' && fromSessionParam.trim().length > 0
      ? fromSessionParam.trim()
      : undefined
  const openSearchRequested =
    openSearchParam === '1' || openSearchParam === 'true'

  const searchQuery = typeof search === 'string' && search.trim().length > 0 ? search : undefined
  const anchorParam = typeof anchor_index === 'string' ? Number.parseInt(anchor_index, 10) : NaN
  const hasAnchorParam = Number.isFinite(anchorParam)

  useEffect(() => {
    useNavLockStore.getState().clear()
  }, [])

  // Started during RENDER, not in an effect. useConversation's merge memo runs
  // in this same first render pass, so an effect-started trace misses it
  // entirely on a warm open — the memo's marks and counters land while
  // `current` is still null and are silently dropped. Ref-guarded so it opens
  // once per conversation. No-op unless EXPO_PUBLIC_OPEN_TRACE=1.
  const tracedIdRef = useRef<string | null>(null)
  /* eslint-disable react-hooks/refs -- render-phase probe start; see note above */
  if (tracedIdRef.current !== id) {
    tracedIdRef.current = id
    startOpenTrace(id)
  }
  /* eslint-enable react-hooks/refs */
  useEffect(() => () => finishOpenTrace('unmount'), [id])

  // In-chat search entry: toggles a query bar that writes ?search= on submit.
  // Prefills / auto-opens when navigation already carries a search param (Hub)
  // or openSearch=1 (resumed-scrollback "search" link — empty bar + keyboard).
  // Synced during render (same pattern as fetchAnchor below) so we don't need
  // an effect that setStates on searchQuery changes.
  const [searchBarState, setSearchBarState] = useState<{
    open: boolean
    draft: string
    syncedQuery: string | undefined
    syncedOpenSearch: boolean
  }>({ open: false, draft: '', syncedQuery: undefined, syncedOpenSearch: false })
  if (
    searchQuery !== searchBarState.syncedQuery ||
    openSearchRequested !== searchBarState.syncedOpenSearch
  ) {
    setSearchBarState({
      open: searchQuery || openSearchRequested ? true : searchBarState.open,
      draft: searchQuery ?? '',
      syncedQuery: searchQuery,
      syncedOpenSearch: openSearchRequested,
    })
  }
  const { open: searchOpen, draft: searchDraft } = searchBarState

  const submitInChatSearch = useCallback(() => {
    const trimmed = searchDraft.trim()
    if (trimmed.length === 0) {
      router.setParams({ search: '', anchor_index: '' })
      return
    }
    // Clear any prior anchor_index so the search-target resolver runs again.
    router.setParams({ search: trimmed, anchor_index: '' })
  }, [router, searchDraft])

  // Resolves an active search query to the message to scroll to and highlight.
  // Skipped when the caller supplied anchor_index directly. A 404 leaves
  // targetQuery.data undefined — the conversation opens at its normal tail with
  // no highlight, never blocking navigation.
  const targetQuery = useQuery({
    queryKey: ['searchTarget', serverId, id, searchQuery],
    queryFn: () =>
      createApiForServer(serverId).query<SearchTargetResponse>(
        `/api/conversations/${encodeURIComponent(id)}/search-target`,
        { q: searchQuery },
      ),
    enabled: Boolean(searchQuery) && !hasAnchorParam && Boolean(serverId && id),
    retry: false,
    staleTime: Infinity,
    meta: { persist: false },
  })

  const matchIndexes = hasAnchorParam ? undefined : targetQuery.data?.match_indexes
  const totalMatches = hasAnchorParam ? undefined : targetQuery.data?.total_matches
  // Active-match pointer. Defaults to the tail-most match until the user steps
  // prev/next. Tracked as an override rather than derived-then-synced-via-effect
  // so a fresh matchIndexes array (new search) resets it without a
  // render-triggering setState in an effect.
  const [matchPosOverride, setMatchPosOverride] = useState<{ forIndexes: number[]; pos: number } | null>(null)
  const activeMatchPos =
    matchIndexes && matchPosOverride?.forIndexes === matchIndexes
      ? matchPosOverride.pos
      : matchIndexes && matchIndexes.length > 0
        ? matchIndexes.length - 1
        : null

  // Settle-then-apply: resolving the target must complete before the anchored
  // (or tail) fetch fires, or the user briefly sees the tail before the jump.
  const isResolvingTarget = Boolean(searchQuery) && !hasAnchorParam && targetQuery.isPending

  const anchorIndex = hasAnchorParam
    ? anchorParam
    : activeMatchPos != null && matchIndexes
      ? matchIndexes[activeMatchPos]
      : undefined
  const isAnchored = anchorIndex != null

  // The window we fetch is keyed separately from the active match: stepping to a
  // match already in the loaded window must NOT re-fetch — only stepping outside
  // re-anchors. Seeded at render (React "reset state on key change" pattern) to
  // the initial tail-most anchor when a fresh match set resolves, so it never
  // tracks the moving anchorIndex. This backs the "endless skeleton" invariant.
  const [fetchAnchor, setFetchAnchor] = useState<{ forIndexes: number[]; index: number } | null>(null)
  if (matchIndexes && anchorIndex != null && fetchAnchor?.forIndexes !== matchIndexes) {
    setFetchAnchor({ forIndexes: matchIndexes, index: anchorIndex })
  }
  const fetchAnchorIndex =
    matchIndexes && fetchAnchor?.forIndexes === matchIndexes ? fetchAnchor.index : anchorIndex

  const {
    data: conversation,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    fetchNewerPage,
    isFetchingNewerPage,
    totalMessages,
    loadedMessages,
    triggerDelta,
  } = useConversation(serverId, id, { anchorIndex: fetchAnchorIndex, enabled: !isResolvingTarget })

  // P2.2: external-session live push. Phase-1 keys external transcript frames by
  // the conversation UUID in the sessionId field, so mounting the stream with
  // sessionId === conversationId === id makes the hook's strict-equality filter
  // match unchanged. Read-only: liveMessages is merged after REST history, never
  // sent back. The subscription stays mounted while paused (tearing it down
  // would clear liveMessages and drop live-only bubbles); pausing freezes the
  // rendered snapshot instead — see mergedMessages below.
  const [livePaused, setLivePaused] = useState(false)
  const { liveMessages } = useConversationStream(serverId, id, id)

  // Latched true once a conversation_updated growth push arrives for this
  // conversation. Combined at render with live WS frames into `isLive`, which
  // drives the pause/resume control's visibility so it only appears on a
  // genuinely live session, not on static history.
  const [isLiveEvent, setIsLiveEvent] = useState(false)

  // P2.1: while this screen is focused AND the app is foregrounded, poll the
  // delta drain so REST history stays fresh against an unmodified server. The
  // drain self-throttles (5s canTrigger), so the 3s cadence is intentionally
  // finer than the throttle rather than aligned to it. Stops on blur
  // (useFocusEffect cleanup) or background.
  useFocusEffect(
    useCallback(() => {
      // Paused: hold the transcript as-is — run no freshness poll at all.
      if (livePaused) return
      let timer: ReturnType<typeof setInterval> | null = null
      const start = () => {
        if (timer == null) timer = setInterval(triggerDelta, LIVE_POLL_INTERVAL_MS)
      }
      const stop = () => {
        if (timer != null) {
          clearInterval(timer)
          timer = null
        }
      }
      if (AppState.currentState === 'active') start()
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') start()
        else stop()
      })
      return () => {
        stop()
        sub.remove()
      }
    }, [triggerDelta, livePaused]),
  )

  // P2.2: the additive conversation_updated push is an extra drain trigger — an
  // external writer grew this conversation's JSONL, so pull the delta now
  // instead of waiting for the next poll tick.
  useEffect(() => {
    const client = wsManager.getClient(serverId)
    if (!client) return
    return client.on('conversation_updated', (msg) => {
      if (msg.type !== 'conversation_updated' || msg.conversationId !== id) return
      // A growth push means the session is live — surface the pause control even
      // while paused (so the user can resume). Only drain when not paused.
      setIsLiveEvent(true)
      if (!livePaused) triggerDelta()
    })
  }, [serverId, id, triggerDelta, livePaused])

  // Live WS frames landing are also a liveness signal (covers servers that push
  // conversation_event(s) without a separate conversation_updated). Latched at
  // render — once live, stays live for the screen's life — so no state effect.
  const isLive = isLiveEvent || liveMessages.length > 0

  // Resuming catches the transcript up in one drain — the poll + WS take over again.
  const toggleLivePaused = useCallback(() => {
    setLivePaused((prev) => {
      if (prev) triggerDelta()
      return !prev
    })
  }, [triggerDelta])

  // Merge WS-live messages after REST history for the tail view. When nothing is
  // streaming this is referentially the same array as conversation.messages, so
  // the non-live render path stays byte-identical.
  const liveMerged = useMemo(() => {
    if (!conversation) return []
    return liveMessages.length > 0
      ? mergeLiveMessages(conversation.messages, liveMessages)
      : conversation.messages
  }, [conversation, liveMessages])

  // Pausing freezes the transcript: hold the last live merge and keep showing it
  // until the user resumes (nothing is dropped, nothing new appears). The ref is
  // only advanced while NOT paused — a render-time snapshot cache, not reactive
  // state, so it can't itself schedule a render.
  const frozenRef = useRef<Message[]>([])
  // eslint-disable-next-line react-hooks/refs -- render-time freeze snapshot; see note above
  if (!livePaused) frozenRef.current = liveMerged
  // eslint-disable-next-line react-hooks/refs -- render-time freeze snapshot; see note above
  const mergedMessages = livePaused ? frozenRef.current : liveMerged

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
  // attached. An idle, detached session bounces straight back here, so
  // redirecting on mere existence is an infinite loop. Prefer streamer
  // `lifecycle` when present; fall back to ptyAttached on older servers.
  const isSessionLive =
    liveSession?.lifecycle != null
      ? liveSession.lifecycle === 'attached'
      : liveSession?.ptyAttached === true
  useEffect(() => {
    if (isConvNotFound && isSessionLive) {
      router.replace(`/session/${id}?server=${serverId}`)
    }
  }, [isConvNotFound, isSessionLive, id, serverId, router])

  // True 404 (no live session either): drop the favorite so Open Session
  // cannot keep routing into a dead conversation id.
  useEffect(() => {
    if (!isConvNotFound || isSessionLoading || isSessionLive || !serverId || !id) return
    evictStaleConversationFavorite(serverId, id)
  }, [isConvNotFound, isSessionLoading, isSessionLive, serverId, id])

  const [infoVisible, setInfoVisible] = useState(false)
  const [footerHeight, setFooterHeight] = useState(0)
  // Flips once FlashList reports it has drawn its items (onLoad). Reset per
  // conversation / per re-anchor so a new window re-gates the skeleton.
  const [listDrawn, setListDrawn] = useState(false)
  const favoriteId = buildFavoriteId(serverId, 'conversation', id)
  const isFavorite = useQuickAccessStore((s) => s.favorites.some((f) => f.id === favoriteId))
  const [starScale] = useState(() => new Animated.Value(1))
  const showSlowLoadingMsg = useLoadingStateStore((s) => s.slowCounts.messages > 0)
  const [glowOpacity] = useState(() => new Animated.Value(0))
  const [glowScale] = useState(() => new Animated.Value(0.85))

  // Re-gate the skeleton when the conversation or the fetch window changes.
  // queueMicrotask defers the setState out of the effect body (avoids the
  // cascading-render lint) while still landing before paint.
  useEffect(() => {
    queueMicrotask(() => setListDrawn(false))
  }, [id, fetchAnchorIndex])

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
      : [
          ...previousFavorites,
          {
            type: 'conversation' as const,
            id: favoriteId,
            label: conversation?.title || conversation?.projectPath || id || '',
            serverId,
            conversationId: id,
          },
        ]

    useQuickAccessStore.setState({ favorites: nextFavorites })
    try {
      await AsyncStorage.setItem(
        QUICK_ACCESS_STORAGE_KEY,
        JSON.stringify({ ...useQuickAccessStore.getState(), favorites: nextFavorites }),
      )
      animateStar()
    } catch (err) {
      useQuickAccessStore.setState({ favorites: previousFavorites })
      Alert.alert(t('favorites.errorTitle'), err instanceof Error ? err.message : t('favorites.updateFailed'))
    }
  }, [animateStar, conversation?.projectPath, conversation?.title, favoriteId, id, isFavorite, serverId, t])

  // Skeleton stays up until the fetch lands AND FlashList has drawn its items
  // (onLoad → listDrawn). The 400ms useMinDisplayTime floor is the anti-flicker
  // mechanism from bug-1 — just enough to avoid a skeleton flash on fast loads.
  const isReady = conversation !== undefined && listDrawn
  const isGated = useMinDisplayTime(isReady, 400, id)

  const handleListReady = useCallback(() => {
    traceMark('listDrawn')
    finishOpenTrace('listDrawn')
    setListDrawn(true)
  }, [])

  // Empty conversations never fire onLoad (ListEmptyComponent path) — lift the
  // gate so we don't sit under a skeleton for an empty state.
  useEffect(() => {
    if (conversation && conversation.messages.length === 0) {
      queueMicrotask(() => setListDrawn(true))
    }
  }, [conversation])

  const qc = useQueryClient()
  const { resume, adoptSession, forkSession } = useSessionActions(serverId, id)

  // Seed the session cache from the resume snapshot (so /session/:id renders
  // without a round-trip) then hand off to the live session, carrying the
  // conversation it was resumed from.
  //
  // `starting=1` lands on the pending screen: /api/sessions/resume answers
  // before the PTY attaches, so the session reads idle+detached for a moment —
  // which the session screen's ended-session redirect would otherwise mistake
  // for "finished" and bounce straight back here. The pending screen replaces
  // itself with the live session on session_ready. markNavigatedToSession stops
  // the global session_ready listener pushing that same route a second time.
  const navigateToResumedSession = useCallback(
    (result: ResumeResult) => {
      if (result.sessionSnapshot) {
        qc.setQueryData(['session', serverId, result.sessionId], result.sessionSnapshot)
      }
      const startParams = new URLSearchParams({ server: serverId })
      if (result.projectId) startParams.set('projectId', result.projectId)
      const projectPath = result.projectPath ?? conversation?.projectPath
      if (projectPath) startParams.set('projectPath', projectPath)
      startParams.set('resumedFromConversationId', result.conversationId)
      startParams.set('starting', '1')
      markNavigatedToSession(result.sessionId)
      router.replace(`/session/${result.sessionId}?${startParams.toString()}`)
    },
    [qc, serverId, conversation?.projectPath, router],
  )

  // Second-chance resume after the user acknowledges a possible collision.
  // `force: true` always proceeds server-side (contract), so a repeat 409 is
  // not expected — any error here is a genuine failure.
  const forceResume = useCallback(() => {
    // Named locally (not the outer const) so the Retry button can call it again
    // without a useCallback self-reference.
    function attempt() {
      resume.mutate(
        { force: true },
        {
          onSuccess: navigateToResumedSession,
          onError: (err) =>
            Alert.alert(t('resume.failed'), err instanceof Error ? err.message : String(err), [
              { text: t('common:button.cancel'), style: 'cancel' },
              { text: t('common:button.retry'), onPress: attempt },
            ]),
        },
      )
    }
    attempt()
  }, [resume, navigateToResumedSession, t])

  // Take over: stop the process that already owns this conversation, then adopt
  // it as a streamer session. Destructive but SAFE — the server waits for the
  // old process to actually exit before spawning, so it cannot leave two agents
  // writing one transcript (which is what "open anyway" risks).
  const takeOverSession = useCallback(() => {
    adoptSession.mutate(undefined, {
      onSuccess: (data) => {
        // Same spawn race as resume — see navigateToResumedSession.
        markNavigatedToSession(data.sessionId)
        router.replace(`/session/${data.sessionId}?server=${serverId}&starting=1`)
      },
      onError: (err) =>
        Alert.alert(t('resume.takeOverFailed'), err instanceof Error ? err.message : String(err)),
    })
  }, [adoptSession, router, serverId, t])

  // Fork into Threadbase: start a separate managed continuation instead of
  // fighting the client that already holds the Codex writer lock. The original
  // session keeps running and keeps its rollout; the fork gets its own.
  //
  // No Retry button on failure — the request is non-idempotent and the server
  // contract carries no idempotency key, so a retry of a fork that actually
  // succeeded server-side would leave two forks. The user can re-open the
  // collision dialog from Resume instead.
  const forkIntoThreadbase = useCallback(() => {
    Alert.alert(t('resume.forkTitle'), t('resume.forkMessage'), [
      { text: t('common:button.cancel'), style: 'cancel' },
      {
        text: t('resume.fork'),
        onPress: () =>
          forkSession.mutate(undefined, {
            onSuccess: (result) => {
              if (result.sessionSnapshot) {
                qc.setQueryData(['session', serverId, result.sessionId], result.sessionSnapshot)
              }
              const startParams = new URLSearchParams({ server: serverId })
              if (result.projectId) startParams.set('projectId', result.projectId)
              const projectPath = result.projectPath ?? conversation?.projectPath
              if (projectPath) startParams.set('projectPath', projectPath)
              // Both identities travel: the source we forked from, and the new
              // rollout the server bound to the managed session.
              startParams.set('forkedFromConversationId', id)
              startParams.set('conversationId', result.conversationId)
              startParams.set('starting', '1')
              markNavigatedToSession(result.sessionId)
              router.replace(`/session/${result.sessionId}?${startParams.toString()}`)
            },
            onError: (err) =>
              Alert.alert(t('resume.forkFailed'), err instanceof Error ? err.message : String(err)),
          }),
      },
    ])
  }, [forkSession, qc, serverId, conversation?.projectPath, id, router, t])

  // Resume this conversation into a live session. The server soft-blocks with a
  // 409 CONVERSATION_BUSY when the conversation may still be open elsewhere; on
  // that we confirm with the user — naming what was detected, honestly (it *may*
  // still be open, never "is open") — and only then retry with force. A clean
  // resume proceeds straight through.
  const handleResume = useCallback(() => {
    // Named locally (not the outer const) so the Retry button can call it again
    // without a useCallback self-reference.
    function attempt() {
      resume.mutate(
        {},
        {
          onSuccess: navigateToResumedSession,
          onError: (err) => {
            if (err instanceof ConversationBusyError) {
              const entries = err.detectedBy.length > 0 ? err.detectedBy : ['unknown']
              const reasons = Array.from(
                new Set(
                  entries.map((reason) => getResumeReasonLabel(reason, t)),
                ),
              ).join('; ')
              // Codex enforces its own single-writer lock, so a confirmed Codex
              // owner is a hard "no", not a "may still be open" hedge. The copy
              // differs accordingly; the actions come from the server's explicit
              // capabilities either way (see ConversationBusyError for the
              // defaults that keep older streamers on the Claude flow).
              const isCodexLock =
                err.reasonCode === 'CODEX_SESSION_ACTIVE' || err.provider === CODEX_CLI_PROVIDER
              const title = isCodexLock ? t('resume.codexBusyTitle') : t('resume.collisionTitle')
              const message = isCodexLock
                ? t('resume.codexBusyMessage', { reasons })
                : t('resume.collisionMessage', { reasons })
              Alert.alert(title, message, [
                { text: t('common:button.cancel'), style: 'cancel' },
                ...(err.canTakeOver
                  ? [
                      {
                        text: t('resume.takeOver'),
                        style: 'destructive' as const,
                        onPress: takeOverSession,
                      },
                    ]
                  : []),
                ...(err.canFork ? [{ text: t('resume.fork'), onPress: forkIntoThreadbase }] : []),
                ...(err.canForce ? [{ text: t('resume.confirm'), onPress: forceResume }] : []),
              ])
            } else {
              Alert.alert(t('resume.failed'), err instanceof Error ? err.message : String(err), [
                { text: t('common:button.cancel'), style: 'cancel' },
                { text: t('common:button.retry'), onPress: attempt },
              ])
            }
          },
        },
      )
    }
    attempt()
  }, [resume, navigateToResumedSession, forceResume, takeOverSession, forkIntoThreadbase, t])

  const handleBackToLiveSession = useCallback(() => {
    if (!fromSession) return
    markNavigatedToSession(fromSession)
    router.replace(`/session/${fromSession}?server=${serverId}`)
  }, [fromSession, router, serverId])

  const handleShare = useCallback(async () => {
    if (!conversation) return
    const md = conversation.messages
      .map((m) => {
        const role = m.role === 'user' ? t('share.roleUser') : t('share.roleAssistant')
        const text = m.content
          .filter((b) => b.type === 'text')
          .map((b) => (b as { text: string }).text)
          .join('\n')
        return `**${role}**\n\n${text}`
      })
      .join('\n\n---\n\n')
    await Share.share({ message: md })
  }, [conversation, t])

  const lastMessageId = conversation?.messages[conversation.messages.length - 1]?.id

  // Steps the active match by delta (wrapping). In-window: just move the
  // highlighted match + counter (fetch anchor stays put, no refetch). Out of
  // window: advance the fetch anchor, triggering a fresh anchored fetch and
  // re-gating the skeleton for the new window.
  const handleStep = useCallback(
    (delta: 1 | -1, loadedRowIndex: number) => {
      if (!matchIndexes || matchIndexes.length === 0 || activeMatchPos == null) return
      const nextPos = (activeMatchPos + delta + matchIndexes.length) % matchIndexes.length
      setMatchPosOverride({ forIndexes: matchIndexes, pos: nextPos })
      if (loadedRowIndex === -1) {
        setFetchAnchor({ forIndexes: matchIndexes, index: matchIndexes[nextPos] })
      }
    },
    [matchIndexes, activeMatchPos],
  )

  const handleFooterLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height
    setFooterHeight((prev) => (Math.abs(prev - h) > 0.5 ? h : prev))
  }, [])

  const listContentStyle = useMemo(
    () => [styles.listContent, { paddingBottom: footerHeight + spacing.lg }],
    [footerHeight, styles],
  )

  const renderSkeletonItem = useCallback(
    ({ index }: ListRenderItemInfo<string>) => <MessageSkeletonRow index={index} />,
    [],
  )

  const headerActions = (
    <View style={styles.headerActions}>
      {isLive ? <LivePauseControl paused={livePaused} onToggle={toggleLivePaused} /> : null}
      <Pressable
        onPress={() => setSearchBarState((prev) => ({ ...prev, open: !prev.open }))}
        hitSlop={8}
        accessibilityLabel={t('search.open')}
        testID="conversation-search-btn"
        style={({ pressed }) => [
          styles.headerButton,
          searchOpen && styles.headerButtonActive,
          { opacity: pressed ? 0.5 : 1 },
        ]}
      >
        <MagnifyingGlass
          size={22}
          color={searchOpen ? theme.text.primary : theme.text.secondary}
        />
      </Pressable>
      <Pressable
        onPress={() => {
          void toggleFavorite()
        }}
        hitSlop={8}
        accessibilityLabel={isFavorite ? t('common:favorite.remove') : t('common:favorite.add')}
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
      >
        <Animated.View style={{ transform: [{ scale: starScale }], position: 'relative' }}>
          <Animated.View
            style={{
              transform: [{ scale: glowScale }],
              opacity: glowOpacity,
              position: 'absolute',
              top: -6,
              right: -6,
              bottom: -6,
              left: -6,
            }}
          >
            <Star size={28} color={theme.text.accent} weight="fill" />
          </Animated.View>
          <Star
            size={22}
            color={isFavorite ? theme.text.accent : theme.text.secondary}
            weight={isFavorite ? 'fill' : 'regular'}
          />
        </Animated.View>
      </Pressable>
      <Pressable
        onPress={() => setInfoVisible(true)}
        hitSlop={8}
        accessibilityLabel={t('info.open')}
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
      >
        <InfoIcon size={22} color={theme.text.secondary} />
      </Pressable>
    </View>
  )

  const searchBar = searchOpen ? (
    <View style={searchStyles.searchBar} testID="conversation-search-bar">
      <TextInput
        testID="conversation-search-input"
        style={searchStyles.searchInput}
        value={searchDraft}
        onChangeText={(text) => setSearchBarState((prev) => ({ ...prev, draft: text }))}
        onSubmitEditing={submitInChatSearch}
        placeholder={t('search.placeholder')}
        placeholderTextColor={theme.text.secondary}
        autoFocus={!searchQuery}
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  ) : null

  if (error) {
    // A 404 from /api/conversations/:id doesn't mean "gone" — it may mean the
    // session is live but hasn't written JSONL yet. Check /api/sessions/:id;
    // if found, redirect to the live session view (handled by the effect above).
    if (isConvNotFound && isSessionLoading) {
      return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <ScreenHeader right={headerActions} />
          {searchBar}
          <View style={styles.centered}>
            <ActivityIndicator color={theme.text.secondary} />
          </View>
        </SafeAreaView>
      )
    }
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="conversation-not-found">
        <ScreenHeader right={headerActions} />
        {searchBar}
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>{t('error.loadFailed')}</Text>
          <Text style={styles.errorMessage}>{isConvNotFound ? t('error.notFound') : error.message}</Text>
          {isConvNotFound ? (
            <TouchableOpacity
              testID="conversation-not-found-back"
              style={styles.retryBtn}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={t('error.back')}
            >
              <Text style={styles.retryBtnText}>{t('error.back')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryBtnText}>{t('common:button.retry')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    )
  }

  // Cold load (no cached data yet) — render skeleton-only screen.
  if (isLoading && !conversation) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScreenHeader right={headerActions} />
        {searchBar}
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

  // The search view keeps raw conversation.messages — its match indexes are
  // keyed to REST message_index; mergedMessages (computed above, freeze-aware)
  // backs only the tail history view.
  const mergedLastMessageId = mergedMessages[mergedMessages.length - 1]?.id

  const hasMessages = mergedMessages.length > 0
  const isLoadingMessages = Boolean(hasNextPage || isFetchingNextPage)

  // `resumable` is absent on older servers — treat undefined as resumable. The
  // server's flag is authoritative for both providers (streamer resumes codex
  // via `codex resume` and reports real availability).
  const isCodex = conversation.provider === 'codex-cli'
  const providerColor = isCodex ? brand.codex : brand.claude
  const providerDot = <View style={[styles.providerDot, { backgroundColor: providerColor }]} />
  const notResumable = conversation.resumable === false
  const unavailableMessage = notResumable
    ? conversation.unavailableReason === 'worktree_removed'
      ? t('unavailable.worktreeRemoved')
      : t('unavailable.pathMissing')
    : null
  const showBackToLive = Boolean(fromSession)
  const canResume = !showBackToLive && !notResumable && !resume.isPending
  const resumeLabel = showBackToLive
    ? t('resume.backToLive')
    : notResumable
      ? t('unavailable.cannotResume')
      : resume.isPending
        ? t('resume.resuming')
        : t('resume.start')
  const footerActionDisabled = showBackToLive ? false : notResumable || resume.isPending
  const footerActionTestId = showBackToLive ? 'back-to-live-session-button' : 'resume-button'

  const showSearchView =
    isAnchored &&
    searchQuery != null &&
    matchIndexes != null &&
    matchIndexes.length > 0 &&
    activeMatchPos != null &&
    anchorIndex != null

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title={conversation.title} titleRight={providerDot} right={headerActions} />
      {searchBar}
      <View style={styles.inner}>
        {isGated ? (
          <View style={styles.skeletonOverlay} pointerEvents="none" testID="skeleton-overlay">
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
          <ProgressBar loaded={loadedMessages} total={totalMessages} />
        ) : null}
        {unavailableMessage ? (
          <View style={styles.unavailableBanner}>
            <Text style={styles.unavailableBannerText}>{unavailableMessage}</Text>
          </View>
        ) : null}
        {hasMessages ? (
          showSearchView ? (
            // Keyed on the fetch window: re-anchoring (match step out of the
            // loaded window) swaps to a new anchored fetch, so the list must
            // remount to re-fire onLoad and re-lift the skeleton.
            <ConversationSearchView
              key={`anchor-${fetchAnchorIndex}`}
              messages={conversation.messages}
              lastMessageId={lastMessageId}
              searchQuery={searchQuery}
              matchIndexes={matchIndexes}
              totalMatches={totalMatches}
              anchorIndex={anchorIndex}
              activeMatchPos={activeMatchPos}
              onStep={handleStep}
              onReady={handleListReady}
              onStartReached={fetchNextPage}
              onEndReached={fetchNewerPage}
              isFetchingOlder={isFetchingNextPage}
              isFetchingNewer={isFetchingNewerPage}
              contentContainerStyle={listContentStyle}
            />
          ) : (
            <ConversationHistoryList
              messages={mergedMessages}
              lastMessageId={mergedLastMessageId}
              onReady={handleListReady}
              onStartReached={fetchNextPage}
              isFetchingOlder={isFetchingNextPage}
              contentContainerStyle={listContentStyle}
            />
          )
        ) : (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>{t('list.empty')}</Text>
          </View>
        )}

        <View style={styles.footer} onLayout={handleFooterLayout} testID="conversation-bottom-bar">
          <View style={styles.resumeWrapper}>
            <TouchableOpacity
              style={[styles.resumeBtn, footerActionDisabled && styles.resumeBtnDisabled]}
              onPress={showBackToLive ? handleBackToLiveSession : handleResume}
              disabled={footerActionDisabled}
              testID={footerActionTestId}
            >
              {showBackToLive ? (
                <ArrowLeft size={16} weight="bold" color="#fff" />
              ) : canResume ? (
                <Play size={16} weight="fill" color="#fff" />
              ) : null}
              <Text style={styles.resumeBtnText}>{resumeLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <InfoModal
        visible={infoVisible}
        onClose={() => setInfoVisible(false)}
        title={t('info.title')}
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
          { label: 'Repo URL', value: conversation.repoUrl },
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

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg.primary },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
    },
    headerButtonActive: {
      backgroundColor: 'rgba(88,166,255,0.12)',
    },
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
    footer: {
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    unavailableBanner: {
      backgroundColor: theme.bg.card,
      borderStartWidth: 3,
      borderStartColor: '#f59e0b',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    unavailableBannerText: { color: theme.text.secondary, fontSize: font.sm },
    resumeWrapper: { flex: 1, gap: spacing.xs },
    resumeError: { color: '#ef4444', fontSize: font.xs, textAlign: 'center' },
    resumeBtn: {
      backgroundColor: theme.text.accent,
      borderRadius: 10,
      minHeight: 44,
      flexDirection: 'row',
      gap: spacing.xs,
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
