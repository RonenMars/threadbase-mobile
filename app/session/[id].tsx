import React, { useState, useEffect } from 'react'
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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { InfoIcon, PencilSimple, Star } from 'phosphor-react-native'
import { SessionStatusBadge } from '@/components/sessions/SessionStatusBadge'
import { useSessionDetail } from '@/hooks/useSession'
import { useSessionActions } from '@/hooks/useSessionActions'
import { wsManager } from '@/services/ws-client'
import { useServersStore } from '@/stores/servers'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { InfoModal } from '@/components/shared/InfoModal'
import { ScreenHeader } from '@/components/shared/ScreenHeader'
import { SessionDetailSlowBanner } from '@/components/sessions/SessionDetailSlowBanner'
import { NameSessionModal } from '@/components/sessions/NameSessionModal'
import { useLoadingStateStore } from '@/stores/loading-state'
import { useSessionNamesStore } from '@/stores/sessionNames'
import { useRenameSession } from '@/hooks/useSessionName'
import { MatrixRain } from '@/components/terminal/MatrixRain'
import { useQuickAccessStore, buildFavoriteId } from '@/stores/quickAccess'
import { useSettingsStore } from '@/stores/settings'
import { LiveConversationView } from '@/components/conversation/LiveConversationView'
import { TerminalView } from '@/components/terminal/TerminalView'

const WAKING_UP_PHRASES = [
  "I'm waking up, I'll be ready in a moment…",
  "Loading my entire knowledge of humanity, one sec…",
  "Stretching my context window, almost there…",
  "Brewing a fresh pot of tokens, hold tight…",
  "Reminding myself what code looks like…",
  "Counting to a trillion really fast, nearly done…",
]

function wakingUpPhrase(sessionId: string): string {
  let hash = 0
  for (let i = 0; i < sessionId.length; i++) hash = (hash * 31 + sessionId.charCodeAt(i)) >>> 0
  return WAKING_UP_PHRASES[hash % WAKING_UP_PHRASES.length]
}

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

function WakingUpOverlay({ phrase }: { phrase: string }) {
  const theme = useTheme()
  const wakingStyles = makeWakingStyles(theme)
  const bounce = useSharedValue(0)
  const rotate = useSharedValue(0)
  const pulse = useSharedValue(1)
  const dot1 = useSharedValue(0)
  const dot2 = useSharedValue(0)
  const dot3 = useSharedValue(0)

  useEffect(() => {
    bounce.value = withRepeat(
      withSequence(
        withTiming(-18, { duration: 500, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 500, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    )
    rotate.value = withRepeat(
      withSequence(
        withTiming(-12, { duration: 400 }),
        withTiming(12, { duration: 400 }),
        withTiming(0, { duration: 200 }),
      ),
      -1,
      false,
    )
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    )
    dot1.value = withRepeat(
      withSequence(withTiming(1, { duration: 400 }), withTiming(0.3, { duration: 400 })),
      -1,
      false,
    )
    dot2.value = withDelay(160, withRepeat(
      withSequence(withTiming(1, { duration: 400 }), withTiming(0.3, { duration: 400 })),
      -1,
      false,
    ))
    dot3.value = withDelay(320, withRepeat(
      withSequence(withTiming(1, { duration: 400 }), withTiming(0.3, { duration: 400 })),
      -1,
      false,
    ))
    // Reanimated SharedValues are stable refs — including them here would cause
    // the animation to restart on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const emojiStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bounce.value },
      { rotate: `${rotate.value}deg` },
      { scale: pulse.value },
    ],
  }))
  const dot1Style = useAnimatedStyle(() => ({ opacity: dot1.value }))
  const dot2Style = useAnimatedStyle(() => ({ opacity: dot2.value }))
  const dot3Style = useAnimatedStyle(() => ({ opacity: dot3.value }))

  return (
    <View style={wakingStyles.overlay} testID="waking-up-overlay">
      <View style={wakingStyles.card}>
        <Animated.Text style={[wakingStyles.emoji, emojiStyle]}>🤖</Animated.Text>
        <View style={wakingStyles.dots}>
          <Animated.View style={[wakingStyles.dot, dot1Style]} />
          <Animated.View style={[wakingStyles.dot, dot2Style]} />
          <Animated.View style={[wakingStyles.dot, dot3Style]} />
        </View>
        <Text style={wakingStyles.phrase}>{phrase}</Text>
      </View>
    </View>
  )
}

function makeWakingStyles(theme: Theme) {
  return StyleSheet.create({
    overlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(10, 10, 14, 0.85)',
      zIndex: 10,
    },
    card: {
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 32,
    },
    emoji: {
      fontSize: 72,
    },
    dots: {
      flexDirection: 'row',
      gap: 8,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.text.accent,
    },
    phrase: {
      color: theme.text.secondary,
      fontSize: font.base,
      textAlign: 'center',
      lineHeight: 24,
      maxWidth: 280,
    },
  })
}

function PendingSessionScreen({ serverId, pendingId }: { serverId: string; pendingId: string }) {
  const router = useRouter()
  const { t } = useTranslation(['terminal', 'common'])
  const theme = useTheme()
  const pendingStyles = makePendingStyles(theme)
  const [phraseIdx, setPhraseIdx] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setPhraseIdx((i) => (i + 1) % PENDING_PHRASES.length)
    }, 2500)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const client = wsManager.getClient(serverId)
    if (!client) return

    // Primary: session_ready is an explicit signal from new streamers
    const unsubReady = client.on('session_ready', (msg) => {
      if (msg.type !== 'session_ready') return
      router.replace(`/session/${msg.session.id}?server=${serverId}`)
    })

    // Fallback: older streamers emit session_update with ptyAttached: true instead
    const unsubUpdate = client.on('session_update', (msg) => {
      if (msg.type !== 'session_update') return
      const s = msg.session
      if (!s.id.startsWith('pending_') && s.ptyAttached) {
        router.replace(`/session/${s.id}?server=${serverId}`)
      }
    })

    return () => {
      unsubReady()
      unsubUpdate()
    }
  }, [serverId, router])

  return (
    <SafeAreaView style={pendingStyles.container} edges={['bottom']}>
      <View style={pendingStyles.content}>
        <ActivityIndicator size="large" color={theme.text.accent} style={pendingStyles.spinner} />
        <Text style={pendingStyles.title}>{t('terminal:status.starting')}</Text>
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
    title: { color: theme.text.primary, fontSize: font.lg, fontWeight: '600' },
    phrase: { color: theme.text.secondary, fontSize: font.base, textAlign: 'center', lineHeight: 24 },
    footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
    cancelButton: {
      borderWidth: 1,
      borderColor: theme.text.danger,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    cancelText: { color: theme.text.danger, fontSize: font.base, fontWeight: '500' },
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
  const { id, server } = useLocalSearchParams<{ id: string; server?: string }>()
  const router = useRouter()

  // Fall back to first server if no server param provided (backwards compat)
  const fallbackServerId = useServersStore((s) => s.activeServerIds[0] ?? '')
  const serverId = server || fallbackServerId
  const { sessionView } = useSettingsStore()

  const isPending = id?.startsWith('pending_') ?? false
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
      if (nextState !== 'active') return
      wsManager.forceReconnect(serverId)
      qc.invalidateQueries({ queryKey: ['session', serverId, id] })
    })
    return () => sub.remove()
  }, [serverId, id, isPending, qc])

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

  useEffect(() => {
    if (session?.ptyAttached === false &&
      session?.status === 'idle' &&
      (session?.promptCount ?? 0) > 0 &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id ?? '')
    ) {
      router.replace(`/conversation/${id}?server=${serverId}`)
    }
  }, [session?.ptyAttached, session?.status, session?.promptCount, id, serverId, router])

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
    return <PendingSessionScreen serverId={serverId} pendingId={id!} />
  }

  if (
    session &&
    session.ptyAttached === false &&
    (session.status === 'running' || session.status === 'waiting_input')
  ) {
    return <DiscoveredSessionScreen serverId={serverId} sessionId={id!} />
  }

  const isWakingUp =
    session?.status === 'running' &&
    !hasReachedPrompt &&
    (session?.promptCount ?? 0) === 0

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

  const sessionHeaderActions = (
    <View style={styles.headerActions}>
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
    (session.status === 'waiting_input' || session.status === 'running') &&
    !!session.conversationId

  const noAttachEmptyPlaceholder =
    session.ptyAttached === false &&
    !isLive

  return (
    <SafeAreaView style={styles.flex} edges={['top']} testID="session-detail-screen">
      <ScreenHeader title={sessionName} titleRight={pencilButton} right={sessionHeaderActions} onBack={handleBack} />
      {session ? (
        <View style={styles.statusBar}>
          <SessionStatusBadge status={session.status} isRefetching={false} />
          <Text style={styles.elapsed}>{formatElapsed(session.elapsedMs)}</Text>
          <Text style={styles.prompts}>{t('session.prompts', { count: session.promptCount })}</Text>
        </View>
      ) : null}

      <View style={styles.body}>
        {isLive ? (
          <View style={styles.flex}>
            {sessionView === 'terminal' ? (
              <TerminalView
                serverId={serverId}
                sessionId={id}
                disabled={isWakingUp}
                pendingPlan={planVisible ? pendingPlan : null}
                onClosePlan={() => { setPlanVisible(false); setPendingPlan(null) }}
              />
            ) : (
              <LiveConversationView
                serverId={serverId}
                sessionId={id}
                conversationId={session.conversationId!}
                disabled={isWakingUp}
                pendingPlan={planVisible ? pendingPlan : null}
                onClosePlan={() => { setPlanVisible(false); setPendingPlan(null) }}
              />
            )}
            {isWakingUp ? (
              <WakingUpOverlay phrase={wakingUpPhrase(id)} />
            ) : null}
          </View>
        ) : session.failureReason ? (
          <View style={styles.placeholder}>
            <Text style={[styles.placeholderTitle, { color: theme.text.danger }]}>
              {t('session.failedToStart')}
            </Text>
            <Text style={styles.placeholderText}>{session.failureReason}</Text>
          </View>
        ) : noAttachEmptyPlaceholder && session.status === 'idle' ? (
          <View style={styles.placeholder}>
            <MatrixRain />
            <Text style={styles.placeholderTitle}>{t('session.runningElsewhere')}</Text>
            <Text style={styles.placeholderText}>{t('session.runningElsewhereBody')}</Text>
            {session.projectPath ? (
              <Text style={styles.placeholderPath}>{session.projectPath}</Text>
            ) : null}
            {(session.promptCount ?? 0) > 0 ? (
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
