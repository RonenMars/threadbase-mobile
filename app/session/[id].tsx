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
import { useLocalSearchParams, useNavigation } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { TerminalOutput } from '@/components/terminal/TerminalOutput'
import { PromptQueueSheet } from '@/components/queue/PromptQueueSheet'
import { PlanPreviewSheet } from '@/components/queue/PlanPreviewSheet'
import { SessionStatusBadge } from '@/components/sessions/SessionStatusBadge'
import { useSessionDetail } from '@/hooks/useSession'
import { useTerminalStream } from '@/hooks/useTerminalStream'
import { useSessionActions } from '@/hooks/useSessionActions'
import { wsClient } from '@/services/ws-client'
import { dark, font, spacing } from '@/constants/theme'

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const navigation = useNavigation()
  const { data: session, isLoading } = useSessionDetail(id)
  const { lines, isStreaming, isLoadingHistory } = useTerminalStream(id)
  const { sendInput } = useSessionActions(id)

  const [inputText, setInputText] = useState('')
  const [queueVisible, setQueueVisible] = useState(false)
  const [planVisible, setPlanVisible] = useState(false)
  const [pendingPlan, setPendingPlan] = useState<string | null>(null)

  useEffect(() => {
    if (session) {
      navigation.setOptions({ title: session.projectName })
    }
  }, [session, navigation])

  // Listen for plan_ready events for this session
  useEffect(() => {
    return wsClient.on('plan_ready', (msg) => {
      if (msg.type === 'plan_ready' && msg.sessionId === id) {
        setPendingPlan(msg.plan)
        setPlanVisible(true)
      }
    })
  }, [id])

  const handleSendInput = () => {
    if (!inputText.trim()) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    sendInput.mutate(inputText.trim())
    setInputText('')
  }

  const isWaiting = session?.status === 'waiting_input'

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {session ? (
          <View style={styles.statusBar}>
            <SessionStatusBadge status={session.status} />
            <Text style={styles.elapsed}>{formatElapsed(session.elapsedMs)}</Text>
            <Text style={styles.prompts}>{session.promptCount} prompts</Text>
          </View>
        ) : null}

        <View style={styles.terminal}>
          <TerminalOutput lines={lines} isStreaming={isStreaming} />
          {isLoadingHistory ? (
            <View style={styles.historyLoader}>
              <ActivityIndicator color={dark.text.secondary} />
            </View>
          ) : null}
        </View>

        {isWaiting ? (
          <View style={styles.inputArea}>
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
            <View style={styles.inputButtons}>
              <TouchableOpacity
                style={styles.queueBtn}
                onPress={() => setQueueVisible(true)}
                accessibilityLabel="Open prompt queue"
              >
                <Text style={styles.queueBtnText}>Queue</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
                onPress={handleSendInput}
                disabled={!inputText.trim() || sendInput.isPending}
                accessibilityLabel="Send input"
              >
                <Text style={styles.sendBtnText}>Send</Text>
              </TouchableOpacity>
            </View>
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
          sessionId={id}
          visible={queueVisible}
          onClose={() => setQueueVisible(false)}
        />
      ) : null}

      {pendingPlan ? (
        <PlanPreviewSheet
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
  inputArea: {
    borderTopWidth: 1,
    borderTopColor: dark.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  input: {
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
  inputButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
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
    flex: 1,
    backgroundColor: dark.text.accent,
    borderRadius: 10,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: font.base },
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
