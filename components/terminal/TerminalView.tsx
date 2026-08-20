import React, { useCallback, useState } from 'react'
import { Alert, View, StyleSheet } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useTerminalStream } from '@/hooks/useTerminalStream'
import { ToastViewport } from '@/components/ui/ToastViewport'
import { TerminalRawModeToast } from '@/components/terminal/TerminalRawModeToast'
import { useSessionActions } from '@/hooks/useSessionActions'
import { isPermissionClosedError, isQuestionClosedError } from '@/services/api-client'
import { useComposerState } from '@/hooks/useComposerState'
import { useActiveQuestion } from '@/hooks/useActiveQuestion'
import { permissionAnswerKeys } from '@/utils/permissionAnswerKeys'
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
  const { sendInput, sendKeys, respondToQuestion, answerPermission } = useSessionActions(serverId, sessionId)
  const { question: activeQuestion, clear: clearQuestion, markPending } = useActiveQuestion(serverId, sessionId)

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


  // Await, then transition. The card stays exactly where it is until the server
  // has taken the answer, so a tap on a gate that has already closed clears the
  // card with a calm notice instead of leaving it up and tappable — the server
  // has just said the gate is not open, so a second tap cannot succeed either.
  //
  // Classified by code, never by status class. Only the three closed reasons
  // clear; anything else keeps the card so the user can try again. Two of those
  // three arrive with no `permission_cancelled` alongside them, which makes this
  // the only thing that takes the card down for them.
  // `answered` is captured here, at tap time, and handed back to markPending so
  // the confirmation binds to the gate it was given for. The POST is not
  // instant — the server re-scrapes the screen before accepting — so a second
  // gate can arrive while this is in flight, and confirming "whatever is active
  // now" would ghost one the user never answered.
  const handleAnswerPermission = useCallback(async (optionIndex: number) => {
    const answered = activeQuestion
    if (!answered) return
    try {
      await answerPermission.mutateAsync({
        contentKey: answered.permissionContentKey,
        optionIndex,
        keys: permissionAnswerKeys(answered, optionIndex),
      })
      markPending(answered)
    } catch (err) {
      if (isPermissionClosedError(err instanceof Error ? err : null)) clearQuestion()
    }
  }, [activeQuestion, answerPermission, clearQuestion, markPending])

  const handleAnswerQuestion = useCallback(async (toolUseId: string, answers: Record<string, string | string[]>) => {
    const answered = activeQuestion
    if (!answered) return
    try {
      await respondToQuestion.mutateAsync({ toolUseId, answers })
      markPending(answered)
    } catch (err) {
      if (isQuestionClosedError(err instanceof Error ? err : null)) clearQuestion()
    }
  }, [activeQuestion, clearQuestion, markPending, respondToQuestion])

  const onSend = async (payload: string) => {
    markSessionUsed(sessionId)
    try {
      await sendInput.mutateAsync(payload)
    } catch (err) {
      Alert.alert(t('dialog.sendFailedTitle'), err instanceof Error ? err.message : String(err))
      throw err
    }
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
  // Same split for the gate route, and the same reason: a gate the server says
  // is closed is not a failure the user must act on, it is the prompt going
  // away. Everything else is a real error and keeps the card up to retry.
  const isGateClosedError = isPermissionClosedError(answerPermission.error)
  const answerFailure = respondToQuestion.isError && !isQuestionGoneError
    ? respondToQuestion.error
    : answerPermission.isError && !isGateClosedError
      ? answerPermission.error
      : null
  const answerErrorMessage = answerFailure
    ? answerFailure instanceof Error
      ? answerFailure.message
      : t('answer.failed')
    : null
  const answerNoticeMessage =
    (respondToQuestion.isError && isQuestionGoneError) || isGateClosedError ? t('answer.questionClosed') : null
  const sendInputErrorMessage = sendInput.isError
    ? sendInput.error instanceof Error
      ? sendInput.error.message
      : t('dialog.sendFailedGeneric')
    : null
  const sendErrorMessage = sendInputErrorMessage ?? answerErrorMessage

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" automaticOffset>
      <ToastViewport id="terminal" />
      <TerminalRawModeToast visible={confidence === 'low'} />
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
          onAnswer={handleAnswerQuestion}
          onAnswerPermission={handleAnswerPermission}
          onDismissQuestion={clearQuestion}
          onViewResumedConversation={resumedConversationId && !conversationId ? onViewResumedConversation : undefined}
          onSearchResumedConversation={resumedConversationId && !conversationId ? onSearchResumedConversation : undefined}
          disabled={disabled}
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
  terminalVisible: {
    flex: 1,
  },
  terminalHidden: {
    display: 'none',
  },
})
