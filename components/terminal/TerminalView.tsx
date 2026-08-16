import React, { useCallback, useState } from 'react'
import { Alert, View, Text, StyleSheet } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Warning } from 'phosphor-react-native'
import { useTerminalStream } from '@/hooks/useTerminalStream'
import { useSessionActions } from '@/hooks/useSessionActions'
import { isQuestionClosedError } from '@/services/api-client'
import { useComposerState } from '@/hooks/useComposerState'
import { useActiveQuestion } from '@/hooks/useActiveQuestion'
import { TerminalOutput } from '@/components/terminal/TerminalOutput'
import { SessionHistoryFeed } from '@/components/terminal/SessionHistoryFeed'
import { ChatComposer } from '@/components/conversation/ChatComposer'
import { SlashCommandBoard } from '@/components/shared/SlashCommandBoard'
import { SlashCommandArgModal } from '@/components/shared/SlashCommandArgModal'
import { PromptQueueSheet } from '@/components/queue/PromptQueueSheet'
import { PlanPreviewSheet } from '@/components/queue/PlanPreviewSheet'
import { conversationHref } from '@/lib/conversationHref'
import { markSessionUsed } from '@/lib/sessionUsage'
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
  /** Conversation backing this session — seeds a history region above the live terminal tail. */
  conversationId?: string | null
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
  conversationId = null,
}: Props) {
  const { t } = useTranslation('terminal')
  const router = useRouter()
  const { lines, isStreaming, userMessageTexts, parseConfidence } = useTerminalStream(
    serverId,
    sessionId,
    false,
    provider,
  )
  const confidence = parseConfidenceProp ?? parseConfidence
  const { sendInput, sendKeys, respondToQuestion } = useSessionActions(serverId, sessionId)
  const { question: activeQuestion, clear: clearQuestion } = useActiveQuestion(serverId, sessionId)

  // Full-screen history reading mode (see SessionHistoryFeed) — owned here,
  // not in SessionHistoryFeed itself, because entering it also has to hide
  // this component's own TerminalOutput region below. Derived (not reset via
  // an effect) against conversationId: without a conversationId,
  // SessionHistoryFeed doesn't render at all, so honoring a stale `true`
  // here would hide the terminal with no minimize control left to undo it.
  const [historyFull, setHistoryFull] = useState(false)
  const isHistoryFull = historyFull && conversationId != null

  const onViewResumedConversation = useCallback(() => {
    if (!resumedConversationId) return
    router.push(
      conversationHref(resumedConversationId, serverId, undefined, {
        fromSession: sessionId,
      }),
    )
  }, [resumedConversationId, router, serverId, sessionId])

  const onSearchResumedConversation = useCallback(() => {
    if (!resumedConversationId) return
    router.push(
      conversationHref(resumedConversationId, serverId, undefined, {
        fromSession: sessionId,
        openSearch: true,
      }),
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

  // The server closes the question's menu on its own (common, self-healing —
  // it also broadcasts question_cancelled, which dismisses the card), so that
  // case reads as a calm notice rather than a failure the user must act on.
  const isQuestionGoneError = isQuestionClosedError(respondToQuestion.error)
  const answerErrorMessage =
    respondToQuestion.isError && !isQuestionGoneError
      ? respondToQuestion.error instanceof Error
        ? respondToQuestion.error.message
        : t('answer.failed')
      : null
  const answerNoticeMessage = respondToQuestion.isError && isQuestionGoneError ? t('answer.questionClosed') : null
  const sendInputErrorMessage = sendInput.isError
    ? sendInput.error instanceof Error
      ? sendInput.error.message
      : 'Failed to send'
    : null
  const sendErrorMessage = sendInputErrorMessage ?? answerErrorMessage

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" automaticOffset>
      {confidence === 'low' ? (
        <View style={styles.rawNote} testID="terminal-raw-mode-note">
          <Warning size={14} color="#d29922" weight="fill" />
          <Text style={styles.rawNoteText}>{t('session.rawModeNote')}</Text>
        </View>
      ) : null}
      {conversationId ? (
        <SessionHistoryFeed
          serverId={serverId}
          conversationId={conversationId}
          isFull={isHistoryFull}
          onToggleFull={() => setHistoryFull((full) => !full)}
        />
      ) : null}
      {/* Wrapped (not conditionally rendered) so full-screen history hides the
          terminal via style, not unmount — its live PTY stream and scroll
          position must survive being hidden. See SessionHistoryFeed. */}
      <View testID="terminal-output-region" style={isHistoryFull ? styles.terminalHidden : styles.terminalVisible}>
        <TerminalOutput
          lines={lines}
          isStreaming={isStreaming}
          userMessageTexts={userMessageTexts}
          onSendInput={(text) => sendInput.mutate(text)}
          onSendKeys={(keys) => sendKeys.mutate(keys)}
          activeQuestion={activeQuestion}
          onAnswer={(toolUseId, answers) => respondToQuestion.mutate({ toolUseId, answers })}
          onDismissQuestion={clearQuestion}
          onViewResumedConversation={resumedConversationId && !conversationId ? onViewResumedConversation : undefined}
          onSearchResumedConversation={resumedConversationId && !conversationId ? onSearchResumedConversation : undefined}
        />
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
        sendError={sendErrorMessage}
        sendNotice={answerNoticeMessage}
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

const styles = StyleSheet.create({
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
  terminalVisible: {
    flex: 1,
  },
  terminalHidden: {
    display: 'none',
  },
})
