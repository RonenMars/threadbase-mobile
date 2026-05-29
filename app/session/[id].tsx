import React, { useState, useEffect } from 'react'
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { InfoIcon, ImageIcon as PhosphorImage, X, Paperclip, PaperPlaneRight, PencilSimple, Microphone, MicrophoneSlash } from 'phosphor-react-native'
import { TerminalOutput } from '@/components/terminal/TerminalOutput'
import { PromptQueueSheet } from '@/components/queue/PromptQueueSheet'
import { PlanPreviewSheet } from '@/components/queue/PlanPreviewSheet'
import { SessionStatusBadge } from '@/components/sessions/SessionStatusBadge'
import { useSessionDetail } from '@/hooks/useSession'
import { useTerminalStream } from '@/hooks/useTerminalStream'
import { useSessionActions } from '@/hooks/useSessionActions'
import { useVoiceInput } from '@/hooks/useVoiceInput'
import { wsManager } from '@/services/ws-client'
import {
  pickFromCamera,
  pickFromLibrary,
  uploadAttachment,
  type UploadedFile,
} from '@/services/uploads'
import { useServersStore } from '@/stores/servers'
import { useDraftsStore } from '@/stores/drafts'
import { dark, font, radius, spacing } from '@/constants/theme'
import { InfoModal } from '@/components/shared/InfoModal'
import { ScreenHeader } from '@/components/shared/ScreenHeader'
import { SlashCommandBoard } from '@/components/shared/SlashCommandBoard'
import { SlashCommandArgModal } from '@/components/shared/SlashCommandArgModal'
import { SessionDetailSlowBanner } from '@/components/sessions/SessionDetailSlowBanner'
import { RenameSessionSheet } from '@/components/sessions/RenameSessionSheet'
import { NameSessionModal } from '@/components/sessions/NameSessionModal'
import { useLoadingStateStore } from '@/stores/loading-state'
import { useSessionNamesStore } from '@/stores/sessionNames'
import { useSettingsStore } from '@/stores/settings'
import { useRenameSession } from '@/hooks/useSessionName'
import type { SlashCommand } from '@/constants/slashCommands'

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

const wakingStyles = StyleSheet.create({
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
    backgroundColor: dark.text.accent,
  },
  phrase: {
    color: dark.text.secondary,
    fontSize: font.base,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 280,
  },
})

function PendingSessionScreen({ serverId, pendingId }: { serverId: string; pendingId: string }) {
  const router = useRouter()
  const { t } = useTranslation(['terminal', 'common'])
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
        <ActivityIndicator size="large" color={dark.text.accent} style={pendingStyles.spinner} />
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

const pendingStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dark.bg.primary },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, gap: spacing.md },
  spinner: { marginBottom: spacing.md },
  title: { color: dark.text.primary, fontSize: font.lg, fontWeight: '600' },
  phrase: { color: dark.text.secondary, fontSize: font.base, textAlign: 'center', lineHeight: 24 },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  cancelButton: {
    borderWidth: 1,
    borderColor: dark.text.danger,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelText: { color: dark.text.danger, fontSize: font.base, fontWeight: '500' },
})

function DiscoveredSessionScreen({
  serverId,
  sessionId,
}: {
  serverId: string
  sessionId: string
}) {
  const { t } = useTranslation(['terminal', 'common'])
  const router = useRouter()
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

const discStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dark.bg.primary },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  warning: {
    backgroundColor: dark.bg.card,
    borderWidth: 1,
    borderColor: dark.text.warning,
    borderRadius: 10,
    padding: spacing.md,
    gap: spacing.sm,
    width: '100%',
  },
  warningTitle: {
    color: dark.text.warning,
    fontSize: font.base,
    fontWeight: '600',
  },
  warningBody: {
    color: dark.text.secondary,
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
    backgroundColor: dark.text.accent,
  },
  backBtn: {
    backgroundColor: dark.bg.card,
    borderWidth: 1,
    borderColor: dark.border,
  },
  btnDisabled: { opacity: 0.5 },
  restartBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: font.base,
  },
  backBtnText: {
    color: dark.text.primary,
    fontWeight: '600',
    fontSize: font.base,
  },
})

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export default function SessionDetailScreen() {
  const { t } = useTranslation(['terminal', 'common'])
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
  const { sendInput } = useSessionActions(serverId, id)

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
    const showSub = Keyboard.addListener('keyboardWillShow', () => setKeyboardVisible(true))
    const hideSub = Keyboard.addListener('keyboardWillHide', () => setKeyboardVisible(false))
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])
  const [infoVisible, setInfoVisible] = useState(false)
  const [slashBoardVisible, setSlashBoardVisible] = useState(false)
  const [pendingArgCommand, setPendingArgCommand] = useState<SlashCommand | null>(null)
  const [renameSheetVisible, setRenameSheetVisible] = useState(false)
  const [exitModalVisible, setExitModalVisible] = useState(false)

  const getName = useSessionNamesStore((s) => s.getName)
  const getOrigin = useSessionNamesStore((s) => s.getOrigin)
  const { askOnExit, setAskOnExit, autoNameFromMessage } = useSettingsStore()
  const renameSession = useRenameSession(serverId)

  const sessionName = getName(serverId, id) ?? session?.projectName
  const sessionOrigin = getOrigin(serverId, id)

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

  const runUpload = async (source: 'camera' | 'library') => {
    setAttachError(null)
    try {
      const picked = source === 'camera' ? await pickFromCamera() : await pickFromLibrary()
      if (!picked) return
      setIsUploading(true)
      const uploaded = await uploadAttachment(serverId, id, picked)
      setAttachments((prev) => [...prev, uploaded])
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : 'Failed to attach file')
    } finally {
      setIsUploading(false)
    }
  }

  const handleAttach = () => {
    if (isUploading) return
    Alert.alert('Attach photo', undefined, [
      { text: 'Take Photo', onPress: () => runUpload('camera') },
      { text: 'Choose from Library', onPress: () => runUpload('library') },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const handleToggleMic = async () => {
    if (voice.listening) return voice.stop()
    try {
      await voice.start()
    } catch (err) {
      if (err instanceof Error && err.message === 'PERMISSION_DENIED') {
        Alert.alert(t('voice.permissionDeniedTitle'), t('voice.permissionDeniedBody'))
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
  const showInputBar =
    session &&
    session.ptyAttached === true &&
    (session.status === 'waiting_input' || session.status === 'running') &&
    !noAttachEmptyPlaceholder

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
          <ActivityIndicator color={dark.text.secondary} />
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

  const infoButton = (
    <Pressable
      onPress={() => setInfoVisible(true)}
      hitSlop={8}
      accessibilityLabel="Session info"
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
    >
      <InfoIcon size={22} color={dark.text.secondary} />
    </Pressable>
  )

  const pencilButton = (
    <Pressable
      onPress={() => setRenameSheetVisible(true)}
      hitSlop={8}
      accessibilityLabel="Rename session"
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, marginRight: 8 })}
    >
      <PencilSimple size={18} color={dark.text.secondary} />
    </Pressable>
  )

  const headerRight = (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {pencilButton}
      {infoButton}
    </View>
  )

  const handleBack = () => {
    if (askOnExit && sessionOrigin !== 'manual') {
      setExitModalVisible(true)
    } else {
      router.back()
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.flex} edges={['top']} testID="session-detail-screen">
        <ScreenHeader title={sessionName} right={headerRight} onBack={handleBack} />
        {session ? (
          <View style={styles.statusBar}>
            <SessionStatusBadge status={session.status} isRefetching={isStreaming} />
            <Text style={styles.elapsed}>{formatElapsed(session.elapsedMs)}</Text>
            <Text style={styles.prompts}>{t('session.prompts', { count: session.promptCount })}</Text>
          </View>
        ) : null}

        <View style={styles.terminal} testID="terminal-output">
          {session?.failureReason ? (
            <View style={styles.discoveredInfo}>
              <Text style={[styles.discoveredTitle, { color: dark.text.danger }]}>
                {t('session.failedToStart')}
              </Text>
              <Text style={styles.discoveredText}>{session.failureReason}</Text>
            </View>
          ) : noAttachEmptyPlaceholder ? (
            <View style={styles.discoveredInfo}>
              <Text style={styles.discoveredTitle}>{t('session.noTerminal')}</Text>
              <Text style={styles.discoveredText}>{t('session.noTerminalBody')}</Text>
              {session?.projectPath ? (
                <Text style={styles.discoveredPath}>{session.projectPath}</Text>
              ) : null}
            </View>
          ) : (
            <>
              <TerminalOutput lines={lines} isStreaming={isStreaming} />
              {isLoadingHistory ? (
                <View style={styles.historyLoader}>
                  <ActivityIndicator color={dark.text.secondary} />
                </View>
              ) : null}
              {isWakingUp ? (
                <WakingUpOverlay phrase={wakingUpPhrase(id)} />
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
                    <PhosphorImage size={14} color={dark.text.primary} />
                    <Text style={styles.chipText} numberOfLines={1}>
                      {a.originalName}
                    </Text>
                    <TouchableOpacity
                      onPress={() => removeAttachment(a.id)}
                      accessibilityLabel={`Remove ${a.originalName}`}
                      hitSlop={8}
                    >
                      <X size={14} color={dark.text.secondary} />
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
                accessibilityLabel="Attach photo"
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color={dark.text.primary} />
                ) : (
                  <Paperclip size={26} color={dark.text.primary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                testID="message-input-mic"
                style={[styles.attachBtn, isWakingUp && styles.sendBtnDisabled]}
                onPress={handleToggleMic}
                disabled={isWakingUp}
                accessibilityLabel={voice.listening ? t('voice.stop') : t('voice.start')}
                hitSlop={8}
              >
                {voice.listening ? (
                  <MicrophoneSlash size={26} color={dark.status.failed} />
                ) : (
                  <Microphone size={26} color={dark.text.primary} />
                )}
              </TouchableOpacity>
              <TextInput
                testID="message-input"
                style={[styles.input, isWakingUp && styles.inputDisabled]}
                value={isWakingUp ? '' : inputText}
                onChangeText={isWakingUp ? undefined : handleInputChange}
                placeholder={isWakingUp ? 'Starting up…' : 'Send input to session…'}
                placeholderTextColor={dark.text.secondary}
                multiline
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={isWakingUp ? undefined : handleSendInput}
                editable={!isWakingUp}
              />
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  (!inputText.trim() && attachments.length === 0 || isWakingUp) && styles.sendBtnDisabled,
                ]}
                onPress={handleSendInput}
                disabled={
                  (!inputText.trim() && attachments.length === 0) || sendInput.isPending || isWakingUp
                }
                accessibilityLabel={t('action.sendInput')}
              >
                <PaperPlaneRight size={26} color="#fff" />
              </TouchableOpacity>
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

      {renameSheetVisible ? (
        <RenameSessionSheet
          currentName={sessionName ?? ''}
          onSave={(name) => {
            renameSession.mutate({ sessionId: id, name })
            setRenameSheetVisible(false)
          }}
          onClose={() => setRenameSheetVisible(false)}
        />
      ) : null}

      {exitModalVisible ? (
        <NameSessionModal
          visible
          mode="exit"
          currentName={sessionName}
          onSave={(name) => {
            renameSession.mutate({ sessionId: id, name })
            setExitModalVisible(false)
            router.back()
          }}
          onSkip={() => {
            setExitModalVisible(false)
            router.back()
          }}
          onDontAskAgain={() => {
            setAskOnExit(false)
          }}
        />
      ) : null}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dark.bg.primary },
  flex: { flex: 1 },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: dark.bg.secondary,
    borderBottomWidth: 1,
    borderBottomColor: dark.border,
  },
  elapsed: { color: dark.text.secondary, fontSize: font.sm },
  prompts: { color: dark.text.secondary, fontSize: font.sm },
  terminal: { flex: 1 },
  historyLoader: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: dark.bg.primary,
  },
  discoveredInfo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  discoveredTitle: {
    color: dark.text.primary,
    fontSize: font.base,
    fontWeight: '600',
  },
  discoveredText: {
    color: dark.text.secondary,
    fontSize: font.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  discoveredPath: {
    color: dark.text.accent,
    fontSize: font.xs,
    fontFamily: 'monospace',
    marginTop: spacing.sm,
  },
  viewConversationBtn: {
    marginTop: spacing.lg,
    backgroundColor: dark.text.accent,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewConversationBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: font.base,
  },
  inputArea: {
    borderTopWidth: 1,
    borderTopColor: dark.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  sendError: {
    color: dark.status.failed,
    fontSize: font.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: dark.bg.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: dark.border,
    color: dark.text.primary,
    fontSize: font.base,
    padding: spacing.sm,
    maxHeight: 120,
    minHeight: 44,
  },
  queueBtn: {
    backgroundColor: dark.bg.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: dark.border,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  queueBtnText: { color: dark.text.primary, fontSize: font.base },
  sendBtn: {
    width: 52,
    backgroundColor: dark.text.accent,
    borderRadius: 10,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachBtn: {
    width: 52,
    backgroundColor: dark.bg.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: dark.border,
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
    backgroundColor: dark.bg.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: dark.border,
    maxWidth: 200,
  },
  chipText: {
    color: dark.text.primary,
    fontSize: font.xs,
    flexShrink: 1,
  },
  sendBtnDisabled: { opacity: 0.4 },
  inputDisabled: { opacity: 0.5 },
  stopBtn: {
    minHeight: 36,
    minWidth: 36,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  queueBtnBottom: {
    margin: spacing.md,
    backgroundColor: dark.bg.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: dark.border,
    padding: spacing.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
})
