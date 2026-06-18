import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  AppState,
  Linking,
} from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { InfoIcon, ImageIcon as PhosphorImage, X, Paperclip, PaperPlaneRight, PencilSimple, Microphone, MicrophoneSlash, Star } from 'phosphor-react-native'
import { TerminalOutput } from '@/components/terminal/TerminalOutput'
import { PromptQueueSheet } from '@/components/queue/PromptQueueSheet'
import { PlanPreviewSheet } from '@/components/queue/PlanPreviewSheet'
import { SessionStatusBadge } from '@/components/sessions/SessionStatusBadge'
import { useSessionDetail } from '@/hooks/useSession'
import { useTerminalStream } from '@/hooks/useTerminalStream'
import { useSessionActions } from '@/hooks/useSessionActions'
import { useVoiceInput } from '@/hooks/useVoiceInput'
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition'
import { wsManager } from '@/services/ws-client'
import {
  pickFromCamera,
  pickFromLibraryMulti,
  pickFromFiles,
  uploadAttachment,
  type UploadedFile,
} from '@/services/uploads'
import { useServersStore } from '@/stores/servers'
import { useDraftsStore } from '@/stores/drafts'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { InfoModal } from '@/components/shared/InfoModal'
import { ScreenHeader } from '@/components/shared/ScreenHeader'
import { SlashCommandBoard } from '@/components/shared/SlashCommandBoard'
import { SlashCommandArgModal } from '@/components/shared/SlashCommandArgModal'
import { SessionDetailSlowBanner } from '@/components/sessions/SessionDetailSlowBanner'
import { NameSessionModal } from '@/components/sessions/NameSessionModal'
import { useLoadingStateStore } from '@/stores/loading-state'
import { useSessionNamesStore } from '@/stores/sessionNames'
import { useSettingsStore } from '@/stores/settings'
import { useRenameSession } from '@/hooks/useSessionName'
import type { SlashCommand } from '@/constants/slashCommands'
import { MatrixRain } from '@/components/terminal/MatrixRain'
import { useQuickAccessStore, buildFavoriteId, QUICK_ACCESS_STORAGE_KEY } from '@/stores/quickAccess'
import { LiveConversationView } from '@/components/conversation/LiveConversationView'

const WAKING_UP_PHRASES = [
  "I'm waking up, I'll be ready in a moment…",
  "Loading my entire knowledge of humanity, one sec…",
  "Stretching my context window, almost there…",
  "Brewing a fresh pot of tokens, hold tight…",
  "Reminding myself what code looks like…",
  "Counting to a trillion really fast, nearly done…",
]

const RESUMING_PHRASES = [
  "Picking up where we left off…",
  "Reloading our conversation, almost there…",
  "Dusting off my memory banks…",
  "Catching up on everything we discussed…",
  "Restoring context, won't be long…",
  "Refreshing my memory of our chat…",
]

function wakingUpPhrase(sessionId: string, isResume: boolean): string {
  let hash = 0
  for (let i = 0; i < sessionId.length; i++) hash = (hash * 31 + sessionId.charCodeAt(i)) >>> 0
  const phrases = isResume ? RESUMING_PHRASES : WAKING_UP_PHRASES
  return phrases[hash % phrases.length]
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
    <View style={wakingStyles.overlay}>
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

const RTL_RE = /[֐-׿؀-ۿ܀-ݏ]/
function isRtlText(s: string): boolean { return RTL_RE.test(s) }

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

  const isPending = id?.startsWith('pending_') ?? false
  const { data: session, isLoading } = useSessionDetail(serverId, id)
  const isDetailSlow = useLoadingStateStore((s) => s.slowCounts['session-detail'] > 0)
  const skipLiveStream = isPending || (session?.ptyAttached === false && session?.status === 'idle')
  const { lines, isStreaming, isLoadingHistory } = useTerminalStream(serverId, id, skipLiveStream)
  const { sendInput, sendKeys } = useSessionActions(serverId, id)

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
      qc.invalidateQueries({ queryKey: ['terminal-output', serverId, id] })
    })
    return () => sub.remove()
  }, [serverId, id, isPending, qc])

  const setDraft = useDraftsStore((s) => s.setDraft)
  const clearDraft = useDraftsStore((s) => s.clearDraft)
  const hydrateDrafts = useDraftsStore((s) => s.hydrate)

  const [inputText, setInputText] = useState('')
  const voice = useVoiceInput({
    onTranscript: (text) => setInputText(text),
    contextualStrings: ['React', 'TypeScript', 'useEffect', 'Expo', 'TSX', 'Claude'],
  })
  const [micGranted, setMicGranted] = useState(false)
  const checkMicPermission = useCallback(async () => {
    const { granted } = await ExpoSpeechRecognitionModule.getPermissionsAsync()
    setMicGranted(granted)
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void checkMicPermission() }, [checkMicPermission])
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') checkMicPermission()
    })
    return () => sub.remove()
  }, [checkMicPermission])
  const [queueVisible, setQueueVisible] = useState(false)
  const [planVisible, setPlanVisible] = useState(false)
  const [pendingPlan, setPendingPlan] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const insets = useSafeAreaInsets()
  // While the keyboard is open it covers the home-indicator area, so the
  // input's safe-area bottom padding would otherwise leave a dead gap above
  // the keyboard. Collapse it to 0 when the keyboard is visible.
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const showSub = Keyboard.addListener(showEvt, () => setKeyboardVisible(true))
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false))
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])
  const [infoVisible, setInfoVisible] = useState(false)
  const [slashBoardVisible, setSlashBoardVisible] = useState(false)
  const sessionFavoriteId = buildFavoriteId(serverId, 'session', id ?? '')
  const isSessionFavorite = useQuickAccessStore((s) => s.favorites.some((f) => f.id === sessionFavoriteId))
  const starScale = useSharedValue(1)
  const [pendingArgCommand, setPendingArgCommand] = useState<SlashCommand | null>(null)
  const [renameSheetVisible, setRenameSheetVisible] = useState(false)
  const [activeTab, setActiveTab] = useState<'terminal' | 'chat'>('terminal')

  const getName = useSessionNamesStore((s) => s.getName)
  const { autoNameFromMessage } = useSettingsStore()
  const renameSession = useRenameSession(serverId)
  const sessionName = getName(serverId, id) ?? session?.projectName

  useEffect(() => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id ?? '')
    // Only redirect to the conversation view if the session actually produced
    // messages. Idle PTYs with zero prompts never wrote a JSONL file, so
    // /api/conversations/:id 404s on them.
    if (
      session?.ptyAttached === false &&
      session?.status === 'idle' &&
      (session?.promptCount ?? 0) > 0 &&
      isUuid
    ) {
      router.replace(`/conversation/${id}?server=${serverId}`)
    }
  }, [session?.ptyAttached, session?.status, session?.promptCount, id, serverId, router])

  // Track whether Claude has reached its first interactive prompt for THIS
  // session id. The streamer reports `waiting_input` once the prompt marker
  // fires; until then we treat the session as "waking up" so the input bar
  // shows the overlay and disables sending into a not-yet-ready PTY.
  // (See pty-manager.ts pendingReady — server-side input queueing covers the
  // race when the user does send anyway, but the overlay is the right UX.)
  // Sticky-per-session-id state: resets when `id` changes, latches true once
  // status hits `waiting_input`. setState is deferred to a microtask so the
  // `react-hooks/set-state-in-effect` rule is satisfied (the rule forbids
  // synchronous setState in an effect body but allows it inside a callback).
  const [hasReachedPrompt, setHasReachedPrompt] = useState(false)
  useEffect(() => {
    queueMicrotask(() => setHasReachedPrompt(false))
  }, [id])

  const glowOpacity = useSharedValue(0)
  const glowScale = useSharedValue(0.85)

  // Reanimated shared values can only be mutated before they are read by a
  // useAnimatedStyle (the React Compiler's immutability rule fixes a value as
  // immutable once captured for styling). The toggle bumps this counter and the
  // effect drives the star + glow animation; both run ahead of the styles below.
  const [starTrigger, setStarTrigger] = useState(0)
  useEffect(() => {
    if (starTrigger === 0) return
    starScale.value = withSequence(
      withTiming(1.12, { duration: 140, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 180, easing: Easing.inOut(Easing.cubic) }),
    )
    glowOpacity.value = withSequence(
      withTiming(0.3, { duration: 120, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 200, easing: Easing.inOut(Easing.cubic) }),
    )
    glowScale.value = withSequence(
      withTiming(0.85, { duration: 0 }),
      withTiming(1.08, { duration: 120, easing: Easing.out(Easing.cubic) }),
      withTiming(1.24, { duration: 200, easing: Easing.inOut(Easing.cubic) }),
    )
    // SharedValues are stable refs; only starTrigger should re-fire this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starTrigger])

  const starAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: starScale.value }],
  }))
  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }))

  const toggleFavorite = useCallback(async () => {
    const previousFavorites = useQuickAccessStore.getState().favorites
    const nextFavorites = isSessionFavorite
      ? previousFavorites.filter((f) => f.id !== sessionFavoriteId)
      : [...previousFavorites, {
          type: 'session' as const,
          id: sessionFavoriteId,
          label: sessionName || id || '',
          serverId,
          sessionId: id,
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
      setStarTrigger((n) => n + 1)
    } catch (err) {
      useQuickAccessStore.setState({ favorites: previousFavorites })
      Alert.alert('Favorites error', err instanceof Error ? err.message : 'Failed to update favorites')
    }
  }, [id, isSessionFavorite, serverId, sessionFavoriteId, sessionName])
  useEffect(() => {
    if (session?.status === 'waiting_input') {
      queueMicrotask(() => setHasReachedPrompt(true))
    }
  }, [session?.status])

  useEffect(() => {
    hydrateDrafts().then(() => {
      const draft = useDraftsStore.getState().getDraft(serverId, id)
      if (draft) setInputText(draft)
    })
  }, [serverId, id, hydrateDrafts])

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

  const handleInputChange = (text: string) => {
    setInputText(text)
    if (serverId && id) setDraft(serverId, id, text)
    // Show board whenever the text starts with exactly "/" (optionally followed by a query)
    const isSlashQuery = /^\/.{0,30}$/.test(text)
    setSlashBoardVisible(isSlashQuery)
  }

  const handleSlashCommandSelect = (command: SlashCommand) => {
    setSlashBoardVisible(false)
    if (command.needsArgs) {
      // Clear the partial slash text so it doesn't bleed into the arg modal
      setInputText('')
      setPendingArgCommand(command)
    } else {
      // Execute immediately: replace whatever slash text was typed with the command
      const payload = `/${command.id}`
      if (wsManager.getClient(serverId)?.status() !== 'connected') {
        Alert.alert('Not connected', 'Waiting for connection — try again in a moment.')
        return
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      sendInput.mutate(payload, {
        onError: (err) =>
          Alert.alert('Send failed', err instanceof Error ? err.message : String(err)),
      })
      resetComposer()
    }
  }

  const handleSlashArgConfirm = (command: SlashCommand, arg: string) => {
    setPendingArgCommand(null)
    const payload = `/${command.id} ${arg}`
    if (wsManager.getClient(serverId)?.status() !== 'connected') {
      Alert.alert('Not connected', 'Waiting for connection — try again in a moment.')
      return
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    sendInput.mutate(payload, {
      onError: (err) =>
        Alert.alert('Send failed', err instanceof Error ? err.message : String(err)),
    })
    resetComposer()
  }

  const buildPayload = () => {
    const trimmed = inputText.trim()
    if (!trimmed && attachments.length === 0) return null
    const refs = attachments.map((a) => `@${a.path}`).join(' ')
    return refs && trimmed ? `${refs} ${trimmed}` : refs || trimmed
  }

  const resetComposer = () => {
    setInputText('')
    setAttachments([])
    setAttachError(null)
    if (serverId && id) clearDraft(serverId, id)
  }

  const handleSendInput = () => {
    const payload = buildPayload()
    if (!payload) return
    if (wsManager.getClient(serverId)?.status() !== 'connected') {
      Alert.alert('Not connected', 'Waiting for connection — try again in a moment.')
      return
    }
    // Auto-name from first message
    if (autoNameFromMessage && !getName(serverId, id)) {
      const autoName = inputText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20)
      if (autoName) {
        renameSession.mutate({ sessionId: id, name: autoName, origin: 'auto' })
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    sendInput.mutate(payload, {
      onError: (err) =>
        Alert.alert('Send failed', err instanceof Error ? err.message : String(err)),
    })
    resetComposer()
  }

  const runUpload = async (source: 'camera' | 'library' | 'files') => {
    setAttachError(null)
    try {
      let images: Awaited<ReturnType<typeof pickFromLibraryMulti>>
      if (source === 'camera') {
        const single = await pickFromCamera()
        if (!single) return
        images = [single]
      } else if (source === 'library') {
        images = await pickFromLibraryMulti()
        if (images.length === 0) return
      } else {
        images = await pickFromFiles()
        if (images.length === 0) return
      }
      setIsUploading(true)
      const uploaded = await Promise.all(images.map((img) => uploadAttachment(serverId, id, img)))
      setAttachments((prev) => [...prev, ...uploaded])
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : 'Failed to attach file')
    } finally {
      setIsUploading(false)
    }
  }

  const handleAttach = () => {
    if (isUploading) return
    Alert.alert('Attach', undefined, [
      { text: 'Take Photo', onPress: () => runUpload('camera') },
      { text: 'Choose from Gallery', onPress: () => runUpload('library') },
      { text: 'Choose Files', onPress: () => runUpload('files') },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const handleToggleMic = async () => {
    if (voice.listening) return voice.stop()
    try {
      await voice.start()
      setMicGranted(true)
    } catch (err) {
      if (err instanceof Error && err.message === 'PERMISSION_DENIED') {
        setMicGranted(false)
        Alert.alert(t('voice.permissionDeniedTitle'), t('voice.permissionDeniedBody'), [
          { text: t('common:button.cancel'), style: 'cancel' },
          { text: t('common:button.openSettings'), onPress: () => Linking.openSettings() },
        ])
      }
    }
  }

  const removeAttachment = (attachmentId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
  }

  const noAttachEmptyPlaceholder =
    session?.ptyAttached === false &&
    !isLoadingHistory &&
    lines.length === 0 &&
    !isStreaming

  // Sessions without PTY attached — input cannot be sent through the streamer.
  // The chat tab renders its own composer (LiveConversationView), so the
  // terminal input bar must be suppressed there to avoid two reply boxes.
  const showInputBar =
    session &&
    session.ptyAttached === true &&
    (session.status === 'waiting_input' || session.status === 'running') &&
    !noAttachEmptyPlaceholder &&
    activeTab !== 'chat'

  // "Waking up" = PTY status is running and Claude has never reported
  // waiting_input for THIS session id on this mount. hasReachedPrompt latches
  // true the first time waiting_input arrives and resets on id change. The
  // overlay must NOT depend on lines.length: on resume Claude emits banner /
  // restored conversation chunks before reaching the prompt, and the user must
  // not be able to send input until status === 'waiting_input' — otherwise
  // the input lands in Claude's boot UI and is swallowed (the "dot bug").
  const isWakingUp =
    session?.status === 'running' &&
    !isStreaming &&
    !hasReachedPrompt

  const inputPlaceholder = isWakingUp
    ? (session?.resumedFromConversationId ? 'Picking up where we left off…' : 'Starting up…')
    : 'Send input to session…'

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
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
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
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
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
        onPress={() => { void toggleFavorite() }}
        hitSlop={8}
        accessibilityLabel={isSessionFavorite ? 'Remove from favorites' : 'Add to favorites'}
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
      >
        <Animated.View style={[starAnimatedStyle, { position: 'relative' }]}>
          <Animated.View style={[glowAnimatedStyle, { position: 'absolute', top: -6, right: -6, bottom: -6, left: -6 }]}>
            <Star size={28} color={theme.text.accent} weight="fill" />
          </Animated.View>
          <Star size={22} color={isSessionFavorite ? theme.text.accent : theme.text.secondary} weight={isSessionFavorite ? 'fill' : 'regular'} />
        </Animated.View>
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.flex} edges={['top']} testID="session-detail-screen">
        <ScreenHeader title={sessionName} titleRight={pencilButton} right={sessionHeaderActions} onBack={handleBack} />
        {session ? (
          <View style={styles.statusBar}>
            <SessionStatusBadge status={session.status} isRefetching={isStreaming} />
            <Text style={styles.elapsed}>{formatElapsed(session.elapsedMs)}</Text>
            <Text style={styles.prompts}>{t('session.prompts', { count: session.promptCount })}</Text>
          </View>
        ) : null}

        {session?.conversationId ? (
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'terminal' && styles.tabActive]}
              onPress={() => setActiveTab('terminal')}
              testID="session-tab-terminal"
            >
              <Text style={[styles.tabText, activeTab === 'terminal' && styles.tabTextActive]}>{t('session.tabTerminal')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'chat' && styles.tabActive]}
              onPress={() => setActiveTab('chat')}
              testID="session-tab-chat"
            >
              <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>{t('session.tabChat')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.terminal} testID="terminal-output">
          {activeTab === 'chat' && session?.conversationId ? (
            <LiveConversationView
              serverId={serverId}
              sessionId={id}
              conversationId={session.conversationId}
            />
          ) : session?.failureReason ? (
            <View style={styles.discoveredInfo}>
              <Text style={[styles.discoveredTitle, { color: theme.text.danger }]}>
                {t('session.failedToStart')}
              </Text>
              <Text style={styles.discoveredText}>{session.failureReason}</Text>
            </View>
          ) : noAttachEmptyPlaceholder ? (
            <View style={styles.discoveredInfo}>
              {session?.status === 'idle' ? (
                <>
                  <MatrixRain />
                  <Text style={styles.discoveredTitle}>{t('session.runningElsewhere')}</Text>
                  <Text style={styles.discoveredText}>{t('session.runningElsewhereBody')}</Text>
                  {session?.projectPath ? (
                    <Text style={styles.discoveredPath}>{session.projectPath}</Text>
                  ) : null}
                  {(session?.promptCount ?? 0) > 0 ? (
                    <TouchableOpacity
                      style={styles.viewConversationBtn}
                      onPress={() => router.replace(`/conversation/${id}?server=${serverId}`)}
                    >
                      <Text style={styles.viewConversationBtnText}>{t('session.openConversation')}</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={styles.discoveredTitle}>{t('session.noTerminal')}</Text>
                  <Text style={styles.discoveredText}>{t('session.noTerminalBody')}</Text>
                  {session?.projectPath ? (
                    <Text style={styles.discoveredPath}>{session.projectPath}</Text>
                  ) : null}
                </>
              )}
            </View>
          ) : (
            <>
              <TerminalOutput
                lines={lines}
                isStreaming={isStreaming}
                onSendInput={session?.status === 'waiting_input'
                  ? (text) => sendInput.mutate(text, { onError: (err) => Alert.alert('Send failed', err instanceof Error ? err.message : String(err)) })
                  : undefined}
                onSendKeys={session?.status === 'waiting_input'
                  ? (keys) => sendKeys.mutate(keys, { onError: (err) => Alert.alert('Send failed', err instanceof Error ? err.message : String(err)) })
                  : undefined}
              />
              {isLoadingHistory ? (
                <View style={styles.historyLoader}>
                  <ActivityIndicator color={theme.text.secondary} />
                </View>
              ) : null}
              {isWakingUp ? (
                <WakingUpOverlay phrase={wakingUpPhrase(id, !!session?.resumedFromConversationId)} />
              ) : null}
            </>
          )}
        </View>

        {showInputBar ? (
          <View style={[styles.inputArea, { paddingBottom: spacing.sm + (keyboardVisible ? 0 : insets.bottom) }]}>
            {sendInput.isError ? (
              <Text style={styles.sendError} numberOfLines={2}>
                {sendInput.error instanceof Error
                  ? sendInput.error.message
                  : 'Failed to send'}
              </Text>
            ) : null}
            {attachError ? (
              <Text style={styles.sendError} numberOfLines={2}>
                {attachError}
              </Text>
            ) : null}
            {attachments.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                {attachments.map((a) => (
                  <View key={a.id} style={styles.chip}>
                    <PhosphorImage size={14} color={theme.text.primary} />
                    <Text
                      style={[styles.chipText, isRtlText(a.originalName) && styles.chipTextRtl]}
                      numberOfLines={1}
                      textBreakStrategy="simple"
                    >
                      {a.originalName}
                    </Text>
                    <TouchableOpacity
                      onPress={() => removeAttachment(a.id)}
                      accessibilityLabel={`Remove ${a.originalName}`}
                      hitSlop={8}
                    >
                      <X size={14} color={theme.text.secondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : null}
            <View style={styles.inputRow}>
              <TouchableOpacity
                style={[styles.attachBtn, (isUploading || isWakingUp) && styles.sendBtnDisabled]}
                onPress={handleAttach}
                disabled={isUploading || isWakingUp}
                accessibilityLabel="Attach file"
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color={theme.text.primary} />
                ) : (
                  <Paperclip size={26} color={theme.text.primary} />
                )}
              </TouchableOpacity>
              <TextInput
                testID="message-input"
                style={[styles.input, isWakingUp && styles.inputDisabled]}
                value={isWakingUp ? '' : inputText}
                onChangeText={isWakingUp ? undefined : handleInputChange}
                placeholder={inputPlaceholder}
                placeholderTextColor={theme.text.secondary}
                multiline
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={isWakingUp ? undefined : handleSendInput}
                editable={!isWakingUp}
              />
              {inputText.trim() || attachments.length > 0 ? (
                <TouchableOpacity
                  testID="send-message-button"
                  style={[
                    styles.sendBtn,
                    isWakingUp && styles.sendBtnDisabled,
                  ]}
                  onPress={handleSendInput}
                  disabled={sendInput.isPending || isWakingUp}
                  accessibilityLabel={t('action.sendInput')}
                >
                  <PaperPlaneRight size={26} color={theme.text.onAccent} />
                </TouchableOpacity>
              ) : micGranted ? (
                <TouchableOpacity
                  testID="message-input-mic"
                  style={[styles.sendBtn, isWakingUp && styles.sendBtnDisabled]}
                  onPress={handleToggleMic}
                  disabled={isWakingUp}
                  accessibilityLabel={voice.listening ? t('voice.stop') : t('voice.start')}
                >
                  {voice.listening ? (
                    <MicrophoneSlash size={26} color={theme.text.onAccent} />
                  ) : (
                    <Microphone size={26} color={theme.text.onAccent} />
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  testID="send-message-button"
                  style={[styles.sendBtn, styles.sendBtnDisabled]}
                  disabled
                  accessibilityLabel={t('action.sendInput')}
                >
                  <PaperPlaneRight size={26} color={theme.text.onAccent} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : null}
      </SafeAreaView>

      {session ? (
        <PromptQueueSheet
          serverId={serverId}
          sessionId={id}
          visible={queueVisible}
          onClose={() => setQueueVisible(false)}
        />
      ) : null}

      {pendingPlan ? (
        <PlanPreviewSheet
          serverId={serverId}
          sessionId={id}
          plan={pendingPlan}
          visible={planVisible}
          onClose={() => {
            setPlanVisible(false)
            setPendingPlan(null)
          }}
        />
      ) : null}

      <SlashCommandBoard
        visible={slashBoardVisible}
        query={inputText.startsWith('/') ? inputText.slice(1) : ''}
        onSelect={handleSlashCommandSelect}
        onDismiss={() => {
          setSlashBoardVisible(false)
          setInputText('')
        }}
      />

      <SlashCommandArgModal
        command={pendingArgCommand}
        onConfirm={handleSlashArgConfirm}
        onDismiss={() => setPendingArgCommand(null)}
      />

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

    </KeyboardAvoidingView>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg.primary },
    flex: { flex: 1 },
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
    terminal: { flex: 1 },
    historyLoader: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.bg.primary,
    },
    discoveredInfo: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
      gap: spacing.sm,
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
    discoveredPath: {
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
    inputArea: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      padding: spacing.sm,
      gap: spacing.sm,
    },
    sendError: {
      color: theme.status.failed,
      fontSize: font.sm,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
    },
    input: {
      flex: 1,
      backgroundColor: theme.bg.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      color: theme.text.primary,
      fontSize: font.base,
      padding: spacing.sm,
      maxHeight: 120,
      minHeight: 44,
    },
    queueBtn: {
      backgroundColor: theme.bg.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: spacing.lg,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    queueBtnText: { color: theme.text.primary, fontSize: font.base },
    sendBtn: {
      width: 52,
      backgroundColor: theme.text.accent,
      borderRadius: 10,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    attachBtn: {
      width: 52,
      backgroundColor: theme.bg.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    chipsRow: {
      flexDirection: 'row',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      backgroundColor: theme.bg.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      maxWidth: 200,
    },
    chipText: {
      color: theme.text.primary,
      fontSize: font.xs,
      flexShrink: 1,
    },
    chipTextRtl: {
      writingDirection: 'rtl',
      textAlign: 'right',
    },
    sendBtnDisabled: { opacity: 0.4 },
    inputDisabled: { opacity: 0.5 },
    tabBar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
    tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center' },
    tabActive: { borderBottomWidth: 2, borderBottomColor: theme.text.accent },
    tabText: { color: theme.text.secondary },
    tabTextActive: { color: theme.text.accent, fontWeight: '600' },
    stopBtn: {
      minHeight: 36,
      minWidth: 36,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xs,
    },
    queueBtnBottom: {
      margin: spacing.md,
      backgroundColor: theme.bg.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing.md,
      alignItems: 'center',
      minHeight: 44,
      justifyContent: 'center',
    },
  })
}
