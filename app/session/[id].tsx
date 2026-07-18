import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  AppState,
} from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { InfoIcon, PencilSimple, Star, StopCircle } from 'phosphor-react-native'
import { SessionStatusBadge } from '@/components/sessions/SessionStatusBadge'
import { useSessionDetail } from '@/hooks/useSession'
import { useSessionActions } from '@/hooks/useSessionActions'
import { useTerminalStream } from '@/hooks/useTerminalStream'
import { wsManager } from '@/services/ws-client'
import { useServersStore } from '@/stores/servers'
import { isTerminalSession } from '@/utils/terminalSession'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { InfoModal } from '@/components/shared/InfoModal'
import { ScreenHeader } from '@/components/shared/ScreenHeader'
import { SessionDetailSlowBanner } from '@/components/sessions/SessionDetailSlowBanner'
import { ConnectionBanner } from '@/components/sessions/ConnectionBanner'
import { useWsStatus } from '@/hooks/useWsStatus'
import { NameSessionModal } from '@/components/sessions/NameSessionModal'
import { useLoadingStateStore } from '@/stores/loading-state'
import { useSessionNamesStore } from '@/stores/sessionNames'
import { useRenameSession } from '@/hooks/useSessionName'
import { MatrixRain } from '@/components/terminal/MatrixRain'
import { useQuickAccessStore, buildFavoriteId } from '@/stores/quickAccess'
import { useSettingsStore } from '@/stores/settings'
import { LiveConversationView } from '@/components/conversation/LiveConversationView'
import { TerminalView } from '@/components/terminal/TerminalView'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { clientLog } from '@/lib/clientLog'

const PENDING_PHRASES = [
  "Claude is putting on its thinking cap…",
  "Warming up the neurons…",
  "Asking the universe for permission…",
  "Summoning inspiration from the void…",
  "Untangling some very tangled thoughts…",
  "Brewing context from scratch…",
  "Teaching bytes to dream in code…",
  "Convincing the electrons to cooperate…",
]

const RECONNECTING_BANNER_DELAY_MS = 5_000
// Max time the waking-up overlay waits on a first terminal_output before it
// gives up and renders the terminal underneath (see wakeTimedOut).
const WAKING_UP_WS_TIMEOUT_MS = 8_000
// The waking-up overlay clears only when a WS session_update pushes
// status → waiting_input (or terminal_output starts). There is no polling
// backstop on the session query, so a dropped/stranded session_update leaves
// the overlay stuck indefinitely. After this long still waking, re-pull the
// authoritative session status over HTTP so the overlay always resolves.
const WAKING_UP_BACKSTOP_MS = 15_000

// The server's own ready-wait window (see tb-streamer START_READY_TIMEOUT_MS)
// — the progress bar animates toward this. After STUCK_AFTER_MS with neither
// session_ready nor a ptyAttached session_update, the process is confirmed
// running but never reached its interactive prompt: offer to watch it live
// instead of leaving the user on an indefinite spinner.
const PENDING_PROGRESS_WINDOW_MS = 10_000
const STUCK_AFTER_MS = 20_000

function PendingSessionScreen({
  serverId,
  pendingId,
  expectExactId = false,
}: {
  serverId: string
  pendingId: string
  /** When true (browse `starting=1`), only accept ready/update for this id. */
  expectExactId?: boolean
}) {
  const router = useRouter()
  const { t } = useTranslation(['terminal', 'common'])
  const theme = useTheme()
  const pendingStyles = makePendingStyles(theme)
  const [phraseIdx, setPhraseIdx] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [stuck, setStuck] = useState(false)
  const [waitNonce, setWaitNonce] = useState(0)
  // pendingId is `pending_<realSessionId>` (see navigateToNewSession) — strip
  // the prefix to get the id the server/stop-session API actually knows.
  const realSessionId = pendingId.replace(/^pending_/, '')
  const { stopSession } = useSessionActions(serverId, realSessionId)

  useEffect(() => {
    const timer = setInterval(() => {
      setPhraseIdx((i) => (i + 1) % PENDING_PHRASES.length)
    }, 2500)
    return () => clearInterval(timer)
  }, [])

  // Bumping waitNonce (via "Wait more") re-arms this timer from a fresh
  // baseline. The press handler resets elapsed/stuck (not this effect) so the
  // reset stays out of the effect body — react-hooks/set-state-in-effect — and
  // the new baseline lands before the next 250ms tick can re-flip `stuck`.
  useEffect(() => {
    const startedAt = Date.now()
    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt
      setElapsedMs(elapsed)
      if (elapsed >= STUCK_AFTER_MS) setStuck(true)
    }, 250)
    return () => clearInterval(timer)
  }, [waitNonce])

  const handleWaitMore = () => {
    setElapsedMs(0)
    setStuck(false)
    setWaitNonce((n) => n + 1)
  }

  useEffect(() => {
    const client = wsManager.getClient(serverId)
    if (!client) {
      clientLog.info('session.pending', 'no WS client — cannot listen for ready', { serverId, pendingId })
      return
    }

    const goReady = (sessionId: string, via: string) => {
      const target = `/session/${sessionId}?server=${serverId}`
      clientLog.info('session.pending', 'ready — replace to session', { sessionId, via, target })
      router.replace(target)
    }

    // Primary: session_ready is an explicit signal from new streamers
    const unsubReady = client.on('session_ready', (msg) => {
      if (msg.type !== 'session_ready') return
      if (expectExactId && msg.session.id !== pendingId) {
        clientLog.info('session.pending', 'session_ready ignored (exact-id mismatch)', {
          msgSessionId: msg.session.id,
          pendingId,
        })
        return
      }
      goReady(msg.session.id, 'session_ready')
    })

    // Fallback: older streamers emit session_update with ptyAttached: true instead
    const unsubUpdate = client.on('session_update', (msg) => {
      if (msg.type !== 'session_update') return
      const s = msg.session
      if (!s.ptyAttached) return
      if (expectExactId) {
        if (s.id !== pendingId) {
          return
        }
      } else if (s.id.startsWith('pending_')) {
        return
      }
      goReady(s.id, 'session_update:ptyAttached')
    })

    return () => {
      unsubReady()
      unsubUpdate()
    }
  }, [serverId, router, pendingId, expectExactId])

  if (stuck) {
    return (
      <SafeAreaView style={pendingStyles.container} edges={['bottom']}>
        <View style={pendingStyles.content}>
          <Text style={pendingStyles.title}>{t('terminal:status.stuckTitle')}</Text>
          <Text style={pendingStyles.phrase}>{t('terminal:status.stuckBody')}</Text>
        </View>
        <View style={[pendingStyles.footer, pendingStyles.stuckActions]}>
          <TouchableOpacity
            style={pendingStyles.waitButton}
            onPress={handleWaitMore}
          >
            <Text style={pendingStyles.waitText}>{t('terminal:status.waitMore')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={pendingStyles.viewConsoleButton}
            onPress={() => router.replace(`/session/${realSessionId}?server=${serverId}`)}
          >
            <Text style={pendingStyles.viewConsoleText}>{t('terminal:status.viewConsole')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={pendingStyles.cancelButton}
            disabled={stopSession.isPending}
            onPress={() => {
              stopSession.mutate(undefined, { onSuccess: () => router.back() })
            }}
          >
            <Text style={pendingStyles.cancelText}>{t('terminal:action.stop')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={pendingStyles.container} edges={['bottom']}>
      <View style={pendingStyles.content}>
        <ActivityIndicator size="large" color={theme.text.accent} style={pendingStyles.spinner} />
        <Text style={pendingStyles.title}>{t('terminal:status.starting')}</Text>
        <View style={pendingStyles.progressTrack}>
          <ProgressBar loaded={elapsedMs} total={PENDING_PROGRESS_WINDOW_MS} />
        </View>
        <Text style={pendingStyles.phrase}>{PENDING_PHRASES[phraseIdx]}</Text>
      </View>
      <View style={pendingStyles.footer}>
        <TouchableOpacity style={pendingStyles.cancelButton} onPress={() => router.back()}>
          <Text style={pendingStyles.cancelText}>{t('common:button.cancel')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

function makePendingStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg.primary },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, gap: spacing.md },
    spinner: { marginBottom: spacing.md },
    title: { color: theme.text.primary, fontSize: font.lg, fontWeight: '600', textAlign: 'center' },
    phrase: { color: theme.text.secondary, fontSize: font.base, textAlign: 'center', lineHeight: 24 },
    progressTrack: { width: '100%', maxWidth: 240 },
    footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
    stuckActions: { gap: spacing.sm },
    cancelButton: {
      borderWidth: 1,
      borderColor: theme.text.danger,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    cancelText: { color: theme.text.danger, fontSize: font.base, fontWeight: '500' },
    waitButton: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    waitText: { color: theme.text.primary, fontSize: font.base, fontWeight: '500' },
    viewConsoleButton: {
      backgroundColor: theme.text.accent,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    viewConsoleText: { color: theme.bg.primary, fontSize: font.base, fontWeight: '600' },
  })
}

function DiscoveredSessionScreen({
  serverId,
  sessionId,
}: {
  serverId: string
  sessionId: string
}) {
  const { t } = useTranslation(['terminal', 'common'])
  const router = useRouter()
  const theme = useTheme()
  const discStyles = makeDiscStyles(theme)
  const { adoptSession } = useSessionActions(serverId, sessionId)

  const handleRestart = () => {
    adoptSession.mutate(undefined, {
      onSuccess: (data) => {
        router.replace(`/session/${data.sessionId}?server=${serverId}`)
      },
      onError: (err) => {
        Alert.alert(
          'Restart failed',
          err instanceof Error ? err.message : 'Unknown error',
        )
      },
    })
  }

  return (
    <SafeAreaView style={discStyles.container} edges={['bottom']}>
      <View style={discStyles.content}>
        <View style={discStyles.warning}>
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <Text style={discStyles.warningTitle}>⚠️ {t('session.alreadyRunningTitle')}</Text>
          <Text style={discStyles.warningBody}>{t('session.alreadyRunningBody')}</Text>
        </View>
        <View style={discStyles.buttons}>
          <TouchableOpacity
            style={[discStyles.btn, discStyles.restartBtn, adoptSession.isPending && discStyles.btnDisabled]}
            onPress={handleRestart}
            disabled={adoptSession.isPending}
          >
            {adoptSession.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={discStyles.restartBtnText}>{t('session.overtake')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[discStyles.btn, discStyles.backBtn, adoptSession.isPending && discStyles.btnDisabled]}
            onPress={() => router.back()}
            disabled={adoptSession.isPending}
          >
            <Text style={discStyles.backBtnText}>{t('common:button.back')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

function makeDiscStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg.primary },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
      gap: spacing.lg,
    },
    warning: {
      backgroundColor: theme.bg.card,
      borderWidth: 1,
      borderColor: theme.text.warning,
      borderRadius: 10,
      padding: spacing.md,
      gap: spacing.sm,
      width: '100%',
    },
    warningTitle: {
      color: theme.text.warning,
      fontSize: font.base,
      fontWeight: '600',
    },
    warningBody: {
      color: theme.text.secondary,
      fontSize: font.sm,
      lineHeight: 20,
    },
    buttons: {
      width: '100%',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    btn: {
      borderRadius: 10,
      minHeight: 48,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
    },
    restartBtn: {
      backgroundColor: theme.text.accent,
    },
    backBtn: {
      backgroundColor: theme.bg.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    btnDisabled: { opacity: 0.5 },
    restartBtnText: {
      color: theme.text.onAccent,
      fontWeight: '700',
      fontSize: font.base,
    },
    backBtnText: {
      color: theme.text.primary,
      fontWeight: '600',
      fontSize: font.base,
    },
  })
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export default function SessionDetailScreen() {
  const { t } = useTranslation(['terminal', 'common'])
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { id, server, starting } = useLocalSearchParams<{
    id: string
    server?: string
    starting?: string
  }>()
  const router = useRouter()

  // Fall back to first server if no server param provided (backwards compat)
  const fallbackServerId = useServersStore((s) => s.activeServerIds[0] ?? '')
  const serverId = server || fallbackServerId
  const { sessionView } = useSettingsStore()

  const isStarting = starting === '1'
  const isPending = (id?.startsWith('pending_') ?? false) || isStarting
  const { data: session, isLoading } = useSessionDetail(serverId, id)
  const isDetailSlow = useLoadingStateStore((s) => s.slowCounts['session-detail'] > 0)

  // When the app returns from background, iOS may have torn down the WS
  // connection without firing onclose, and the streamer may have restarted
  // (deploy, crash-loop) while we were suspended — leaving the on-screen
  // session/terminal frozen at its last cached state. Force a WS reconnect
  // and invalidate the cached queries so the screen rehydrates from server.
  const qc = useQueryClient()
  useEffect(() => {
    if (!serverId || !id || isPending) return
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        wsManager.forceReconnect(serverId)
        qc.invalidateQueries({ queryKey: ['session', serverId, id] })
        return
      }
      // Backgrounding/inactive: proactively ask the server to hold this session
      // now instead of waiting out its ~4.5-min grace timer. The PTY is put on
      // hold (SIGINT + screen disposal, history intact) and resumes on the next
      // subscribe (the 'active' branch above force-reconnects). Harmless no-op
      // server-side if the session isn't live. iOS suspends JS right after this,
      // so it's best-effort — the grace timer remains the backstop.
      if (nextState === 'background') {
        wsManager.send(serverId, { type: 'hold_session', sessionId: id })
      }
    })
    return () => sub.remove()
  }, [serverId, id, isPending, qc])

  // Connection staleness: a dead WS must not masquerade as a live session.
  // Delay the visible stale state so brief WS reconnects don't interrupt the UI.
  const wsStatus = useWsStatus(serverId)
  const wsDisconnected = wsStatus !== 'connected'
  const [showReconnectBanner, setShowReconnectBanner] = useState(false)
  useEffect(() => {
    if (!wsDisconnected) {
      queueMicrotask(() => setShowReconnectBanner(false))
      return
    }
    const timer = setTimeout(() => setShowReconnectBanner(true), RECONNECTING_BANNER_DELAY_MS)
    return () => clearTimeout(timer)
  }, [wsDisconnected])

  const [infoVisible, setInfoVisible] = useState(false)
  const [renameSheetVisible, setRenameSheetVisible] = useState(false)
  const [pendingPlan, setPendingPlan] = useState<string | null>(null)
  const [planVisible, setPlanVisible] = useState(false)

  const sessionFavoriteId = buildFavoriteId(serverId, 'session', id ?? '')
  const isSessionFavorite = useQuickAccessStore((s) => s.favorites.some((f) => f.id === sessionFavoriteId))
  const { pinItem: pinFavorite, unpinItem: unpinFavorite } = useQuickAccessStore()

  const getName = useSessionNamesStore((s) => s.getName)
  const renameSession = useRenameSession(serverId)
  const sessionName = getName(serverId, id) ?? session?.projectName

  const { sendKeys } = useSessionActions(serverId, id ?? '')

  // Mirrors the `isLive` check computed later (post early-returns) — needed
  // here too since useTerminalStream must be called unconditionally, before
  // this component's early returns.
  const isLiveForStream =
    session?.ptyAttached === true &&
    (session?.status === 'waiting_input' || session?.status === 'running') &&
    !(session != null && isTerminalSession(session))
  const { isStreaming } = useTerminalStream(serverId, id ?? '', !isLiveForStream)
  // Esc interrupts the agent's current response without killing the PTY session.
  const stopResponse = () => {
    sendKeys.mutate('\x1b', {
      onError: () => Alert.alert(t('terminal:dialog.stopTitle'), t('terminal:dialog.stopFailed')),
    })
  }

  useEffect(() => {
    // Redirect an ended session to its conversation history. Gate on "has a
    // conversation" (boundConversationId ?? conversationId), NOT promptCount:
    // promptCount counts only prompts sent through the app, so an adopted /
    // externally-started session that has real history reads promptCount 0 and
    // would otherwise strand on the read-only placeholder.
    const hasConversation = !!(session?.boundConversationId ?? session?.conversationId)
    if (session?.ptyAttached === false &&
      session?.status === 'idle' &&
      hasConversation &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id ?? '')
    ) {
      router.replace(`/conversation/${id}?server=${serverId}`)
    }
  }, [session?.ptyAttached, session?.status, session?.boundConversationId, session?.conversationId, id, serverId, router])

  // Codex bind race: before boundConversationId arrives, history may 404 on the
  // placeholder id. When the streamer first publishes the rollout UUID, switch
  // (via historyConversationId) and drop any failed placeholder conversation
  // cache so LiveConversationView hydrates against the bound id.
  // Must run before early returns (rules-of-hooks).
  const prevBoundRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const bound = session?.boundConversationId ?? null
    const prev = prevBoundRef.current
    prevBoundRef.current = bound
    // Skip first paint (prev undefined) and no-op when unbound / unchanged.
    if (prev === undefined || !bound || prev === bound) return
    if (prev != null) return // only act on null/absent → first bind
    const placeholderId = session?.conversationId ?? id
    if (placeholderId) {
      void qc.removeQueries({ queryKey: ['conversation', serverId, placeholderId] })
    }
    void qc.invalidateQueries({ queryKey: ['conversation', serverId, bound] })
  }, [session?.boundConversationId, session?.conversationId, serverId, id, qc])

  // Track whether Claude has reached its first interactive prompt for THIS
  // session id. The streamer reports `waiting_input` once the prompt marker
  // fires; until then we treat the session as "waking up" so the composer
  // shows the disabled overlay and blocks sending into a not-yet-ready PTY.
  // (See pty-manager.ts pendingReady — server-side input queueing covers the
  // race when the user does send anyway, but the overlay is the right UX.)
  // Sticky-per-session-id: resets when `id` changes, latches true once
  // status hits `waiting_input`. setState is deferred to a microtask so the
  // `react-hooks/set-state-in-effect` rule is satisfied.
  const [hasReachedPrompt, setHasReachedPrompt] = useState(false)
  useEffect(() => {
    queueMicrotask(() => setHasReachedPrompt(false))
  }, [id])
  useEffect(() => {
    if (session?.status === 'waiting_input') {
      queueMicrotask(() => setHasReachedPrompt(true))
    }
  }, [session?.status])

  // Backstop: a session can be `running` yet never emit a terminal_output (dead
  // PTY, streamer restart mid-wake) — the waking-up overlay would then spin
  // forever. Fall through to the rendered terminal after a bounded wait so the
  // user sees the (empty) session instead of an infinite spinner.
  const [wakeTimedOut, setWakeTimedOut] = useState(false)
  useEffect(() => {
    queueMicrotask(() => setWakeTimedOut(false))
    const timer = setTimeout(() => setWakeTimedOut(true), WAKING_UP_WS_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [id])

  // Mirrors the post-early-return `isWakingUp` (see below) — computed here so
  // the backstop effect can run unconditionally before the early returns.
  const isWakingUpEarly =
    session?.status === 'running' &&
    !hasReachedPrompt &&
    !isStreaming &&
    (session?.promptCount ?? 0) === 0

  // Backstop for the push-only overlay exit: if we're still waking up after
  // WAKING_UP_BACKSTOP_MS, the session_update that flips status → waiting_input
  // may have been dropped or landed on an unbound handler. Re-pull the session
  // over HTTP (and force a WS reconnect so re-subscribe re-primes the stream)
  // so the overlay never sits unbounded. Re-arms while still waking.
  useEffect(() => {
    if (!isWakingUpEarly || !serverId || !id) return
    const timer = setTimeout(() => {
      if (__DEV__) {
        console.log(`[waking-backstop] still waking after ${WAKING_UP_BACKSTOP_MS}ms — invalidating session ${id} + WS reconnect`)
      }
      wsManager.forceReconnect(serverId)
      void qc.invalidateQueries({ queryKey: ['session', serverId, id] })
    }, WAKING_UP_BACKSTOP_MS)
    return () => clearTimeout(timer)
  }, [isWakingUpEarly, serverId, id, qc])

  // Instrumentation (dev-only): trace the waking-up exit path so a future hang
  // can be attributed to (a) status never flipping, (b) isStreaming, or (c) the
  // backstop. Remove once the delivery-side root cause is confirmed.
  useEffect(() => {
    if (!__DEV__ || isPending) return
    console.log(
      `[waking-trace] id=${id} status=${session?.status} pty=${session?.ptyAttached} prompts=${session?.promptCount} isStreaming=${isStreaming} hasReachedPrompt=${hasReachedPrompt} isWakingUp=${isWakingUpEarly}`,
    )
  }, [id, session?.status, session?.ptyAttached, session?.promptCount, isStreaming, hasReachedPrompt, isWakingUpEarly, isPending])

  // Listen for plan_ready events for this session on the correct server
  useEffect(() => {
    const client = wsManager.getClient(serverId)
    if (!client) return
    return client.on('plan_ready', (msg) => {
      if (msg.type === 'plan_ready' && msg.sessionId === id) {
        setPendingPlan(msg.plan)
        setPlanVisible(true)
      }
    })
  }, [serverId, id])

  if (isPending) {
    return (
      <PendingSessionScreen
        serverId={serverId}
        pendingId={id!}
        expectExactId={isStarting}
      />
    )
  }

  if (
    session &&
    session.ptyAttached === false &&
    (session.status === 'running' || session.status === 'waiting_input')
  ) {
    return <DiscoveredSessionScreen serverId={serverId} sessionId={id!} />
  }

  // isStreaming (live terminal_output arriving) also clears the overlay — a
  // session can be genuinely blocked on a startup dialog (e.g. Codex's
  // hooks/trust gates) that never flips promptCount/hasReachedPrompt, and the
  // user needs to see that dialog rather than a spinner covering it.
  // isWakingUpEarly stays exactly as #328 wrote it (no !wakeTimedOut) — it gates
  // the 15 s re-pull effect. Folding !wakeTimedOut into it would flip it false at
  // 8 s and clear the backstop timer before it ever fires, making #328 dead code.
  const isWakingUp = isWakingUpEarly && !wakeTimedOut

  const infoModal = (
    <InfoModal
      visible={infoVisible}
      onClose={() => setInfoVisible(false)}
      title="Session Info"
      fields={[
        { label: 'ID', value: session?.id ?? id },
        { label: 'Server', value: serverId },
        { label: 'Project Name', value: session?.projectName },
        { label: 'Project Path', value: session?.projectPath },
        { label: 'Branch', value: session?.branch },
        { label: 'Machine', value: session?.machineName },
        { label: 'Status', value: session?.status ?? (isLoading ? 'loading…' : 'not found') },
        { label: 'PTY Attached', value: session != null ? String(session.ptyAttached) : undefined },
        { label: 'Prompt Count', value: session != null ? String(session.promptCount) : undefined },
        { label: 'Elapsed', value: session != null ? formatElapsed(session.elapsedMs) : undefined },
        { label: 'Started At', value: session?.startedAt },
        { label: 'Completed At', value: session?.completedAt },
      ]}
    />
  )

  if (isLoading && !session) {
    return (
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <ScreenHeader />
        <View style={[styles.flex, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator color={theme.text.secondary} />
        </View>
        {isDetailSlow ? <SessionDetailSlowBanner onAbort={() => router.back()} /> : null}
        {infoModal}
      </SafeAreaView>
    )
  }

  if (!session) {
    if (id?.startsWith('disc_')) {
      return <DiscoveredSessionScreen serverId={serverId} sessionId={id} />
    }
    return (
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <ScreenHeader />
        <View style={[styles.flex, { justifyContent: 'center', alignItems: 'center', padding: spacing.lg }]}>
          <Text style={styles.discoveredTitle}>{t('session.notFound')}</Text>
          <Text style={[styles.discoveredText, { textAlign: 'center', marginTop: spacing.sm }]}>
            {`No session found for ID:\n${id}`}
          </Text>
        </View>
        {infoModal}
      </SafeAreaView>
    )
  }

  const canStopResponse = session.status === 'running' || isStreaming

  const sessionHeaderActions = (
    <View style={styles.headerActions}>
      {canStopResponse ? (
        <Pressable
          testID="session-stop-button"
          onPress={stopResponse}
          disabled={sendKeys.isPending}
          hitSlop={8}
          accessibilityLabel={t('terminal:action.stop')}
          style={({ pressed }) => ({ opacity: pressed || sendKeys.isPending ? 0.5 : 1 })}
        >
          {sendKeys.isPending ? (
            <ActivityIndicator size="small" color={theme.text.danger} />
          ) : (
            <StopCircle size={22} color={theme.text.danger} weight="fill" />
          )}
        </Pressable>
      ) : null}
      <Pressable
        onPress={() => {
          if (isSessionFavorite) {
            unpinFavorite(sessionFavoriteId)
          } else {
            pinFavorite({
              type: 'session',
              id: sessionFavoriteId,
              label: sessionName || id || '',
              serverId,
              sessionId: id,
            })
          }
        }}
        hitSlop={8}
        accessibilityLabel={isSessionFavorite ? 'Remove from favorites' : 'Add to favorites'}
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
      >
        <Star size={22} color={isSessionFavorite ? theme.text.accent : theme.text.secondary} weight={isSessionFavorite ? 'fill' : 'regular'} />
      </Pressable>
      <Pressable
        testID="session-info-button"
        onPress={() => setInfoVisible(true)}
        hitSlop={8}
        accessibilityLabel="Session info"
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
      >
        <InfoIcon size={22} color={theme.text.secondary} />
      </Pressable>
    </View>
  )

  const pencilButton = (
    <Pressable
      onPress={() => setRenameSheetVisible(true)}
      hitSlop={8}
      accessibilityLabel="Rename session"
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
    >
      <PencilSimple size={18} color={theme.text.secondary} />
    </Pressable>
  )

  const handleBack = () => {
    router.replace('/')
  }

  const isLive =
    session.ptyAttached === true &&
    (session.status === 'waiting_input' || session.status === 'running')

  // A live PTY may not have a conversationId yet (no JSONL written), but it can
  // already be showing an interactive prompt. LiveConversationView needs the
  // conversationId for REST history; without it we fall back to TerminalView,
  // which only needs the live PTY stream and carries the same question + raw-key
  // affordances — so a prompt is never stranded behind a placeholder.
  // Codex: conversationId stays as the live-session placeholder (=== session.id);
  // boundConversationId is the rollout UUID the scanner indexes. Prefer bound
  // for REST so history resolves; fall back to conversationId for Claude / pre-bind.
  const historyConversationId = session.boundConversationId ?? session.conversationId
  const hasConversationId = !!historyConversationId

  const noAttachEmptyPlaceholder =
    session.ptyAttached === false &&
    !isLive

  return (
    <SafeAreaView style={styles.flex} edges={['top']} testID="session-detail-screen">
      <View>
        <ScreenHeader title={sessionName} titleRight={pencilButton} right={sessionHeaderActions} onBack={handleBack} />
        {session ? (
          <View style={styles.statusBar}>
            <SessionStatusBadge status={session.status} isRefetching={false} />
            <Text style={styles.elapsed}>{formatElapsed(session.elapsedMs)}</Text>
            <Text style={styles.prompts}>{t('session.prompts', { count: session.promptCount })}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        {isLive ? (
          <View style={styles.flex}>
            {showReconnectBanner ? (
              <ConnectionBanner variant="reconnecting" />
            ) : null}
            <View style={showReconnectBanner ? [styles.flex, styles.staleContent] : styles.flex}>
            {sessionView === 'terminal' || !hasConversationId ? (
              <TerminalView
                serverId={serverId}
                sessionId={id}
                disabled={isWakingUp}
                pendingPlan={planVisible ? pendingPlan : null}
                onClosePlan={() => { setPlanVisible(false); setPendingPlan(null) }}
              />
            ) : (
              <LiveConversationView
                key={historyConversationId!}
                serverId={serverId}
                sessionId={id}
                conversationId={historyConversationId!}
                disabled={isWakingUp}
                pendingPlan={planVisible ? pendingPlan : null}
                onClosePlan={() => { setPlanVisible(false); setPendingPlan(null) }}
              />
            )}
            </View>
          </View>
        ) : session.failureReason ? (
          <View style={styles.placeholder}>
            <Text style={[styles.placeholderTitle, { color: theme.text.danger }]}>
              {t('session.failedToStart')}
            </Text>
            <Text style={styles.placeholderText}>{session.failureReason}</Text>
          </View>
        ) : isTerminalSession(session) ? (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderTitle}>{t('session.ended')}</Text>
            <Text style={styles.placeholderText}>{t('session.endedBody')}</Text>
            {session.projectPath ? (
              <Text style={styles.placeholderPath}>{session.projectPath}</Text>
            ) : null}
          </View>
        ) : noAttachEmptyPlaceholder && session.status === 'idle' ? (
          <View style={styles.placeholder}>
            <MatrixRain />
            <Text style={styles.placeholderTitle}>{t('session.runningElsewhere')}</Text>
            <Text style={styles.placeholderText}>{t('session.runningElsewhereBody')}</Text>
            {session.projectPath ? (
              <Text style={styles.placeholderPath}>{session.projectPath}</Text>
            ) : null}
            {hasConversationId ? (
              <TouchableOpacity
                style={styles.viewConversationBtn}
                onPress={() => router.replace(`/conversation/${id}?server=${serverId}`)}
              >
                <Text style={styles.viewConversationBtnText}>{t('session.openConversation')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : noAttachEmptyPlaceholder ? (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderTitle}>{t('session.noTerminal')}</Text>
            <Text style={styles.placeholderText}>{t('session.noTerminalBody')}</Text>
            {session.projectPath ? (
              <Text style={styles.placeholderPath}>{session.projectPath}</Text>
            ) : null}
            {hasConversationId ? (
              <TouchableOpacity
                style={styles.viewConversationBtn}
                onPress={() => router.replace(`/conversation/${id}?server=${serverId}`)}
              >
                <Text style={styles.viewConversationBtnText}>{t('session.openConversation')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>

      {infoModal}

      <NameSessionModal
        visible={renameSheetVisible}
        mode="exit"
        currentName={sessionName ?? ''}
        onSave={(name) => {
          renameSession.mutate({ sessionId: id, name })
          setRenameSheetVisible(false)
        }}
        onCancel={() => setRenameSheetVisible(false)}
      />
    </SafeAreaView>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: theme.bg.primary },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    statusBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: theme.bg.secondary,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    elapsed: { color: theme.text.secondary, fontSize: font.sm },
    prompts: { color: theme.text.secondary, fontSize: font.sm },
    body: { flex: 1 },
    // Content is frozen while the WS is down — make it read as stale, not live.
    staleContent: { opacity: 0.45 },
    placeholder: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
      gap: spacing.sm,
    },
    placeholderTitle: {
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
    },
    placeholderText: {
      color: theme.text.secondary,
      fontSize: font.sm,
      textAlign: 'center',
      lineHeight: 20,
    },
    placeholderPath: {
      color: theme.text.accent,
      fontSize: font.xs,
      fontFamily: 'monospace',
      marginTop: spacing.sm,
    },
    viewConversationBtn: {
      marginTop: spacing.lg,
      backgroundColor: theme.text.accent,
      borderRadius: 10,
      paddingHorizontal: spacing.lg,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    viewConversationBtnText: {
      color: theme.text.onAccent,
      fontWeight: '700',
      fontSize: font.base,
    },
    discoveredTitle: {
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
    },
    discoveredText: {
      color: theme.text.secondary,
      fontSize: font.sm,
      textAlign: 'center',
      lineHeight: 20,
    },
  })
}
