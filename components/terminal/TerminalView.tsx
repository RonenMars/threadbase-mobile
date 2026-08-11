import React, { useCallback } from 'react'
import { Alert, View, Text, StyleSheet } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Warning } from 'phosphor-react-native'
import { useTerminalStream } from '@/hooks/useTerminalStream'
import { useSessionActions } from '@/hooks/useSessionActions'
import { useComposerState } from '@/hooks/useComposerState'
import { useActiveQuestion } from '@/hooks/useActiveQuestion'
import { TerminalOutput } from '@/components/terminal/TerminalOutput'
import { LiveDot } from '@/components/sessions/LiveDot'
import { ChatComposer } from '@/components/conversation/ChatComposer'
import { SlashCommandBoard } from '@/components/shared/SlashCommandBoard'
import { SlashCommandArgModal } from '@/components/shared/SlashCommandArgModal'
import { PromptQueueSheet } from '@/components/queue/PromptQueueSheet'
import { PlanPreviewSheet } from '@/components/queue/PlanPreviewSheet'
import { conversationHref } from '@/lib/conversationHref'
import { markSessionUsed } from '@/lib/sessionUsage'
import { agentSubStatusLabelKey } from '@/lib/agentSubStatus'
import type { ProviderName } from '@/constants/providers'
import type { ParseConfidence } from '@/lib/renderConfidence'

interface Props {
  serverId: string
  sessionId: string
  provider?: ProviderName | string | null
  parseConfidence?: ParseConfidence
  disabled?: boolean
  pendingPlan?: string | null
  onClosePlan?: () => void
  /** Conversation that was resumed into this session — when set, disclose missing PTY scrollback. */
  resumedConversationId?: string | null
}

export function TerminalView({
  serverId,
  sessionId,
  provider,
  parseConfidence: parseConfidenceProp,
  disabled = false,
  pendingPlan = null,
  onClosePlan,
  resumedConversationId = null,
}: Props) {
  const { t } = useTranslation('terminal')
  const { t: tSessions } = useTranslation('sessions')
  const router = useRouter()
  const { lines, isStreaming, subStatus, userMessageTexts, parseConfidence } = useTerminalStream(
    serverId,
    sessionId,
    false,
    provider,
  )
  const confidence = parseConfidenceProp ?? parseConfidence
  const subStatusKey = agentSubStatusLabelKey(subStatus)
  const { sendInput, sendKeys, respondToQuestion } = useSessionActions(serverId, sessionId)
  const { question: activeQuestion } = useActiveQuestion(serverId, sessionId)

  const onViewResumedConversation = useCallback(() => {
    if (!resumedConversationId) return
    router.push(
      conversationHref(resumedConversationId, serverId, undefined, {
        fromSession: sessionId,
      }) as never,
    )
  }, [resumedConversationId, router, serverId, sessionId])

  const onSearchResumedConversation = useCallback(() => {
    if (!resumedConversationId) return
    router.push(
      conversationHref(resumedConversationId, serverId, undefined, {
        fromSession: sessionId,
        openSearch: true,
      }) as never,
    )
  }, [resumedConversationId, router, serverId, sessionId])

  const onSend = (payload: string) => {
    markSessionUsed(sessionId)
    sendInput.mutate(payload, {
      onError: (err) => Alert.alert('Send failed', err instanceof Error ? err.message : String(err)),
    })
  }

  const {
    inputText,
    handleInputChange,
    handleSend,
    slashBoardVisible,
    pendingArgCommand,
    setPendingArgCommand,
    handleSlashCommandSelect,
    handleSlashArgConfirm,
    attachments,
    isUploading,
    attachError,
    handleAttach,
    removeAttachment,
    queueVisible,
    setQueueVisible,
    voice,
    micGranted,
    handleToggleMic,
  } = useComposerState({ serverId, sessionId, onSend })

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" automaticOffset>
      {confidence === 'low' ? (
        <View style={styles.rawNote} testID="terminal-raw-mode-note">
          <Warning size={14} color="#d29922" weight="fill" />
          <Text style={styles.rawNoteText}>{t('session.rawModeNote')}</Text>
        </View>
      ) : null}
      {/* Overlay, not a sibling row: the indicator appears and disappears every
          turn, and in normal flow that resizes the output and makes the
          transcript jump under the reader's eyes. */}
      <View style={styles.outputArea}>
        <TerminalOutput
          lines={lines}
          isStreaming={isStreaming}
          userMessageTexts={userMessageTexts}
          onSendInput={(text) => sendInput.mutate(text)}
          onSendKeys={(keys) => sendKeys.mutate(keys)}
          activeQuestion={activeQuestion}
          onAnswer={(toolUseId, answers) => respondToQuestion.mutate({ toolUseId, answers })}
          onViewResumedConversation={resumedConversationId ? onViewResumedConversation : undefined}
          onSearchResumedConversation={resumedConversationId ? onSearchResumedConversation : undefined}
        />
        {subStatusKey && !activeQuestion ? (
          // Hidden while a gate is open. The gate screen paints no status line,
          // so the derivation holds its last value and the pill would keep
          // claiming "Writing" while the agent is in fact blocked on the user —
          // the one moment the label must not be stale. (The chat view gets
          // this for free: ThinkingBubble early-returns the QuestionCard.)
          // Bottom-LEFT on purpose: TerminalOutput's jump-to-bottom pill is
          // centred at the same offset, and they would sit on top of each other.
          // pointerEvents none so it never swallows a tap meant for the output.
          <View style={styles.subStatusPill} pointerEvents="none" testID="terminal-sub-status">
            {/* The pulse lives on the dot, not the pill: DESIGN.md's live signal
                is a filled circle, and cycling a label to 0.4 opacity makes the
                one thing you want to read the hardest thing to read. */}
            <LiveDot live color={SUB_STATUS_COLOR} size={7} />
            <Text style={styles.subStatusText}>{tSessions(subStatusKey)}</Text>
          </View>
        ) : null}
      </View>
      <ChatComposer
        value={inputText}
        onChangeText={handleInputChange}
        onSend={handleSend}
        onAttach={handleAttach}
        attachments={attachments}
        onRemoveAttachment={removeAttachment}
        isUploading={isUploading}
        attachError={attachError}
        sendError={sendInput.isError ? (sendInput.error instanceof Error ? sendInput.error.message : 'Failed to send') : null}
        disabled={disabled}
        voice={voice}
        micGranted={micGranted}
        onToggleMic={handleToggleMic}
      />

      <SlashCommandBoard
        visible={slashBoardVisible}
        query={inputText.startsWith('/') ? inputText.slice(1) : ''}
        onSelect={handleSlashCommandSelect}
        onDismiss={() => handleInputChange('')}
      />

      <SlashCommandArgModal
        command={pendingArgCommand}
        onConfirm={handleSlashArgConfirm}
        onDismiss={() => setPendingArgCommand(null)}
      />

      <PromptQueueSheet
        serverId={serverId}
        sessionId={sessionId}
        visible={queueVisible}
        onClose={() => setQueueVisible(false)}
      />

      {pendingPlan ? (
        <PlanPreviewSheet
          serverId={serverId}
          sessionId={sessionId}
          plan={pendingPlan}
          visible={pendingPlan != null}
          onClose={() => onClosePlan?.()}
        />
      ) : null}
    </KeyboardAvoidingView>
  )
}

// theme.status.running, hardcoded to match this file's existing palette
// convention (rawNoteText already inlines theme.status.waiting the same way).
// The header badge pulses a LiveDot in this exact colour for the same session,
// so the pill agreeing with it is what makes them read as one signal — blue
// here would borrow the "navigate / past" accent the jump pill owns.
const SUB_STATUS_COLOR = '#3fb950'

const styles = StyleSheet.create({
  outputArea: {
    flex: 1,
  },
  subStatusPill: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(63, 185, 80, 0.14)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(63, 185, 80, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  subStatusText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '500',
  },
  rawNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#21262d',
    borderBottomWidth: 1,
    borderBottomColor: '#30363d',
  },
  rawNoteText: {
    flex: 1,
    color: '#d29922',
    fontSize: 11,
    lineHeight: 15,
  },
})
