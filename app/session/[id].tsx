import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useHeaderHeight } from '@react-navigation/elements'
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
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

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export default function SessionDetailScreen() {
  const { id, server } = useLocalSearchParams<{ id: string; server?: string }>()
  const navigation = useNavigation()
  const router = useRouter()
  const headerHeight = useHeaderHeight()

  // Fall back to first server if no server param provided (backwards compat)
  const fallbackServerId = useServersStore((s) => s.activeServerIds[0] ?? '')
  const serverId = server || fallbackServerId

  const { data: session, isLoading } = useSessionDetail(serverId, id)
  const { lines, isStreaming, isLoadingHistory } = useTerminalStream(serverId, id)
  const { sendInput, addToQueue, cancelSession } = useSessionActions(serverId, id)

  const [inputText, setInputText] = useState('')
  const [queueVisible, setQueueVisible] = useState(false)
  const [planVisible, setPlanVisible] = useState(false)
  const [pendingPlan, setPendingPlan] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const [infoVisible, setInfoVisible] = useState(false)

  const isStoppable =
    session?.source !== 'discovered' &&
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

  useEffect(() => {
    if (!session) return
    navigation.setOptions({
      title: session.projectName,
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setInfoVisible(true)}
          hitSlop={8}
          accessibilityLabel="Session info"
          style={{ paddingHorizontal: spacing.xs }}
        >
          <Ionicons name="information-circle-outline" size={22} color={dark.text.secondary} />
        </TouchableOpacity>
      ),
    })
  }, [session, navigation])

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
    sendInput.mutate(payload, {
      onError: (err) =>
        Alert.alert('Send failed', err instanceof Error ? err.message : String(err)),
    })
    resetComposer()
  }

  const handleQueueInput = () => {
    const payload = buildPayload()
    if (!payload) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    addToQueue.mutate(payload)
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

  // Hide composer only for discovered sessions with no PTY stream yet (placeholder state).
  // Resumed / stream-attached sessions may still be tagged `discovered` while running; they
  // need the same input UI as managed sessions once terminal lines exist or are loading.
  const discoveredEmptyPlaceholder =
    session?.source === 'discovered' &&
    !isLoadingHistory &&
    lines.length === 0 &&
    !isStreaming

  const canSendTerminalInput =
    session &&
    (session.status === 'waiting_input' || session.status === 'running') &&
    !discoveredEmptyPlaceholder

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        {session ? (
          <View style={styles.statusBar}>
            <SessionStatusBadge status={session.status} />
            <Text style={styles.elapsed}>{formatElapsed(session.elapsedMs)}</Text>
            <Text style={styles.prompts}>{session.promptCount} prompts</Text>
          </View>
        ) : null}

        <View style={styles.terminal}>
          {!isLoadingHistory && lines.length === 0 && session?.source === 'discovered' ? (
            <View style={styles.discoveredInfo}>
              <Text style={styles.discoveredTitle}>Discovered Session</Text>
              <Text style={styles.discoveredText}>
                This session was started outside the streamer.{'\n'}
                Terminal output is only available for sessions started via Resume.
              </Text>
              {session.projectPath ? (
                <Text style={styles.discoveredPath}>{session.projectPath}</Text>
              ) : null}
              {session.conversationId ? (
                <TouchableOpacity
                  style={styles.viewConversationBtn}
                  onPress={() => router.push(`/conversation/${session.conversationId}?server=${serverId}`)}
                >
                  <Text style={styles.viewConversationBtnText}>View Conversation</Text>
                </TouchableOpacity>
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

        {canSendTerminalInput ? (
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
                    <Ionicons name="image" size={14} color={dark.text.primary} />
                    <Text style={styles.chipText} numberOfLines={1}>
                      {a.originalName}
                    </Text>
                    <TouchableOpacity
                      onPress={() => removeAttachment(a.id)}
                      accessibilityLabel={`Remove ${a.originalName}`}
                      hitSlop={8}
                    >
                      <Ionicons name="close" size={14} color={dark.text.secondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : null}
            <View style={styles.inputRow}>
              <TouchableOpacity
                style={[styles.attachBtn, isUploading && styles.sendBtnDisabled]}
                onPress={handleAttach}
                disabled={isUploading}
                accessibilityLabel="Attach photo"
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color={dark.text.primary} />
                ) : (
                  <Ionicons name="attach" size={22} color={dark.text.primary} />
                )}
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Send input to session..."
                placeholderTextColor={dark.text.secondary}
                multiline
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={isStreaming ? handleQueueInput : handleSendInput}
              />
              {isStreaming ? (
                <TouchableOpacity
                  style={[
                    styles.queueAddBtn,
                    !inputText.trim() && attachments.length === 0 && styles.sendBtnDisabled,
                  ]}
                  onPress={handleQueueInput}
                  disabled={
                    (!inputText.trim() && attachments.length === 0) || addToQueue.isPending
                  }
                  accessibilityLabel="Add to queue"
                  accessibilityHint="Agent is streaming — your prompt will run after it finishes"
                >
                  <Ionicons name="layers-outline" size={18} color="#fff" />
                  <Text style={styles.queueAddBtnText}>Queue</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.sendBtn,
                    !inputText.trim() && attachments.length === 0 && styles.sendBtnDisabled,
                  ]}
                  onPress={handleSendInput}
                  disabled={
                    (!inputText.trim() && attachments.length === 0) || sendInput.isPending
                  }
                  accessibilityLabel="Send input"
                >
                  <Ionicons name="paper-plane" size={22} color="#fff" />
                </TouchableOpacity>
              )}
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

      {session ? (
        <InfoModal
          visible={infoVisible}
          onClose={() => setInfoVisible(false)}
          title="Session Info"
          fields={[
            { label: 'ID', value: session.id },
            { label: 'Project Name', value: session.projectName },
            { label: 'Project Path', value: session.projectPath },
            { label: 'Branch', value: session.branch },
            { label: 'Machine', value: session.machineName },
            { label: 'Status', value: session.status },
            { label: 'Source', value: session.source },
            { label: 'Prompt Count', value: String(session.promptCount) },
            { label: 'Elapsed', value: formatElapsed(session.elapsedMs) },
            { label: 'Started At', value: session.startedAt },
            { label: 'Completed At', value: session.completedAt },
            { label: 'Conversation ID', value: session.conversationId },
          ]}
        />
      ) : null}
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
    alignItems: 'stretch',
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
  queueAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: dark.text.warning,
    borderRadius: 10,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  queueAddBtnText: {
    color: '#fff',
    fontSize: font.sm,
    fontWeight: '700',
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
