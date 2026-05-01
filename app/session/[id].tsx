import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { InfoIcon, ImageIcon as PhosphorImage, X, Paperclip, PaperPlaneRight } from 'phosphor-react-native'
import { TerminalOutput } from '@/components/terminal/TerminalOutput'
import { PromptQueueSheet } from '@/components/queue/PromptQueueSheet'
import { PlanPreviewSheet } from '@/components/queue/PlanPreviewSheet'
import { SessionStatusBadge } from '@/components/sessions/SessionStatusBadge'
import { useSessionDetail } from '@/hooks/useSession'
import { useTerminalStream } from '@/hooks/useTerminalStream'
import { useSessionActions } from '@/hooks/useSessionActions'
import { wsManager } from '@/services/ws-client'
import {
  pickFromCamera,
  pickFromLibrary,
  uploadAttachment,
  type UploadedFile,
} from '@/services/uploads'
import { useServersStore } from '@/stores/servers'
import { dark, font, spacing } from '@/constants/theme'
import { InfoModal } from '@/components/shared/InfoModal'
import { ScreenHeader } from '@/components/shared/ScreenHeader'
import { SlashCommandBoard } from '@/components/shared/SlashCommandBoard'
import { SlashCommandArgModal } from '@/components/shared/SlashCommandArgModal'
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

function PendingSessionScreen({ serverId, pendingId }: { serverId: string; pendingId: string }) {
  const router = useRouter()
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
    return client.on('session_update', (msg) => {
      if (msg.type !== 'session_update') return
      const s = msg.session
      if (!s.id.startsWith('pending_') && s.ptyAttached) {
        router.replace(`/session/${s.id}?server=${serverId}`)
      }
    })
  }, [serverId, router])

  return (
    <SafeAreaView style={pendingStyles.container} edges={['bottom']}>
      <View style={pendingStyles.content}>
        <ActivityIndicator size="large" color={dark.text.accent} style={pendingStyles.spinner} />
        <Text style={pendingStyles.title}>Starting session…</Text>
        <Text style={pendingStyles.phrase}>{PENDING_PHRASES[phraseIdx]}</Text>
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
})

function DiscoveredSessionScreen({
  serverId,
  sessionId,
}: {
  serverId: string
  sessionId: string
}) {
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
        <Text style={discStyles.title}>Session unavailable</Text>
        <Text style={discStyles.subtitle}>
          This session is running but unavailable.{'\n'}Restart it to re-open?
        </Text>
        <View style={discStyles.buttons}>
          <TouchableOpacity
            style={[discStyles.btn, discStyles.restartBtn, adoptSession.isPending && discStyles.btnDisabled]}
            onPress={handleRestart}
            disabled={adoptSession.isPending}
          >
            {adoptSession.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={discStyles.restartBtnText}>Restart</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[discStyles.btn, discStyles.backBtn, adoptSession.isPending && discStyles.btnDisabled]}
            onPress={() => router.back()}
            disabled={adoptSession.isPending}
          >
            <Text style={discStyles.backBtnText}>Back</Text>
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
  title: {
    color: dark.text.primary,
    fontSize: font.lg,
    fontWeight: '600',
  },
  subtitle: {
    color: dark.text.secondary,
    fontSize: font.base,
    textAlign: 'center',
    lineHeight: 24,
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
  const { id, server } = useLocalSearchParams<{ id: string; server?: string }>()
  const router = useRouter()

  // Fall back to first server if no server param provided (backwards compat)
  const fallbackServerId = useServersStore((s) => s.activeServerIds[0] ?? '')
  const serverId = server || fallbackServerId

  const isPending = id?.startsWith('pending_') ?? false
  const { data: session, isLoading } = useSessionDetail(serverId, id)
  const skipLiveStream = isPending || (session?.ptyAttached === false && session?.status === 'idle')
  const { lines, isStreaming, isLoadingHistory, recordSentInput } = useTerminalStream(serverId, id, skipLiveStream)
  const { sendInput, cancelSession } = useSessionActions(serverId, id)

  const [inputText, setInputText] = useState('')
  const [queueVisible, setQueueVisible] = useState(false)
  const [planVisible, setPlanVisible] = useState(false)
  const [pendingPlan, setPendingPlan] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const [infoVisible, setInfoVisible] = useState(false)
  const [slashBoardVisible, setSlashBoardVisible] = useState(false)
  const [pendingArgCommand, setPendingArgCommand] = useState<SlashCommand | null>(null)

  useEffect(() => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id ?? '')
    if (session?.ptyAttached === false && session?.status === 'idle' && isUuid) {
      router.replace(`/conversation/${id}?server=${serverId}`)
    }
  }, [session?.ptyAttached, session?.status, id, serverId, router])

  if (isPending) {
    return <PendingSessionScreen serverId={serverId} pendingId={id!} />
  }

  const isStoppable =
    session?.ptyAttached === true &&
    (session?.status === 'running' || session?.status === 'waiting_input')

  const handleStop = () => {
    Alert.alert(
      'Stop Claude Code?',
      'This terminates the running claude process for this session.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            cancelSession.mutate(undefined, {
              onSuccess: () => router.back(),
              onError: (err) => {
                Alert.alert(
                  'Failed to stop',
                  err instanceof Error ? err.message : 'Unknown error',
                )
              },
            })
          },
        },
      ],
    )
  }

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

  const handleInputChange = (text: string) => {
    setInputText(text)
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
      recordSentInput(payload)
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
    recordSentInput(payload)
    sendInput.mutate(payload, {
      onError: (err) =>
        Alert.alert('Send failed', err instanceof Error ? err.message : String(err)),
    })
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
  }

  const handleSendInput = () => {
    const payload = buildPayload()
    if (!payload) return
    if (wsManager.getClient(serverId)?.status() !== 'connected') {
      Alert.alert('Not connected', 'Waiting for connection — try again in a moment.')
      return
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    recordSentInput(payload)
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

  const isWakingUp = session?.status === 'running' && !isStreaming && lines.length === 0

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
          <Text style={styles.discoveredTitle}>Session not found</Text>
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="session-detail-screen">
      <ScreenHeader title={session?.projectName} right={infoButton} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 52 : 0}
      >
        {session ? (
          <View style={styles.statusBar}>
            <SessionStatusBadge status={session.status} isRefetching={isStreaming} />
            <Text style={styles.elapsed}>{formatElapsed(session.elapsedMs)}</Text>
            <Text style={styles.prompts}>{session.promptCount} prompts</Text>
          </View>
        ) : null}

        <View style={styles.terminal} testID="terminal-output">
          {session?.failureReason ? (
            <View style={styles.discoveredInfo}>
              <Text style={[styles.discoveredTitle, { color: dark.text.danger }]}>
                Session failed to start
              </Text>
              <Text style={styles.discoveredText}>{session.failureReason}</Text>
            </View>
          ) : noAttachEmptyPlaceholder ? (
            <View style={styles.discoveredInfo}>
              <Text style={styles.discoveredTitle}>No terminal output</Text>
              <Text style={styles.discoveredText}>
                This session has no active terminal.{'\n'}
                Resume the session to start a new terminal.
              </Text>
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
            </>
          )}
        </View>

        {showInputBar ? (
          <View style={styles.inputArea}>
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
                  <Paperclip size={22} color={dark.text.primary} />
                )}
              </TouchableOpacity>
              <TextInput
                testID="message-input"
                style={[styles.input, isWakingUp && styles.inputDisabled]}
                value={isWakingUp ? '' : inputText}
                onChangeText={isWakingUp ? undefined : handleInputChange}
                placeholder={isWakingUp ? wakingUpPhrase(id) : 'Send input to session…'}
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
                accessibilityLabel="Send input"
              >
                <PaperPlaneRight size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>

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
    </SafeAreaView>
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
    ...StyleSheet.absoluteFillObject,
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
    aspectRatio: 1,
    backgroundColor: dark.text.accent,
    borderRadius: 10,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachBtn: {
    aspectRatio: 1,
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
