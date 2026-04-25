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
import { useServersStore } from '@/stores/servers'
import { dark, font, spacing } from '@/constants/theme'

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
  const { sendInput } = useSessionActions(serverId, id)

  const [inputText, setInputText] = useState('')
  const [queueVisible, setQueueVisible] = useState(false)
  const [planVisible, setPlanVisible] = useState(false)
  const [pendingPlan, setPendingPlan] = useState<string | null>(null)

  useEffect(() => {
    if (session) {
      navigation.setOptions({ title: session.projectName })
    }
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

  const handleSendInput = () => {
    if (!inputText.trim()) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    sendInput.mutate(inputText.trim())
    setInputText('')
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
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Send input to session..."
                placeholderTextColor={dark.text.secondary}
                multiline
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={handleSendInput}
              />
              <TouchableOpacity
                style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
                onPress={handleSendInput}
                disabled={!inputText.trim() || sendInput.isPending}
                accessibilityLabel="Send input"
              >
                <Ionicons name="paper-plane" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.queueBtn}
              onPress={() => setQueueVisible(true)}
              accessibilityLabel="Open prompt queue"
            >
              <Text style={styles.queueBtnText}>Queue</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.queueBtnBottom}
            onPress={() => setQueueVisible(true)}
          >
            <Text style={styles.queueBtnText}>Prompt Queue</Text>
          </TouchableOpacity>
        )}
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
  sendBtnDisabled: { opacity: 0.4 },
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
