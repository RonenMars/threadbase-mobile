import React, { useCallback, useState } from 'react'
import { Alert, View, StyleSheet } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useTerminalStream } from '@/hooks/useTerminalStream'
import { ToastViewport } from '@/components/ui/ToastViewport'
import { TerminalRawModeToast } from '@/components/terminal/TerminalRawModeToast'
import { useSessionActions } from '@/hooks/useSessionActions'
import { useComposerState } from '@/hooks/useComposerState'
import { useQuestionAnswer } from '@/hooks/useQuestionAnswer'
import { isPromptPendingError } from '@/services/api-client'
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
  const { sendInput, sendKeys, respondToQuestion, answerPermission, answerPrompt } = useSessionActions(serverId, sessionId)
  const {
    activeQuestion,
    answerPhase,
    answerBusy,
    clearQuestion,
    handleAnswerPermission,
    handleAnswerQuestion,
    handleAnswerPrompt,
    answerErrorMessage,
    answerNoticeMessage,
  } = useQuestionAnswer({ serverId, sessionId, respondToQuestion, answerPermission, answerPrompt })

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

  const onSend = async (payload: string) => {
    markSessionUsed(sessionId)
    try {
      await sendInput.mutateAsync(payload)
    } catch (err) {
      // A prompt is open and the server refused the text. The card sits right
      // above the composer here and the composer already dropped the keyboard
      // on send, so it is in view; the server's message shows inline via
      // sendError. No alert: a modal would take the focus this is trying to
      // hand to the card. The rethrow is what keeps the draft — sendAndReset
      // only clears on success.
      if (isPromptPendingError(err instanceof Error ? err : null)) throw err
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
  // A prompt-pending refusal while the ghost (`'pending'`) is still in flight
  // means the answer we just sent hasn't closed the gate on the server yet —
  // the server's message describes a wrong-answer/still-open case that isn't
  // true here, so show a local line instead. Every other phase, including
  // `'active'`, keeps the server's wording unchanged.
  const sendInputErrorMessage = sendInput.isError
    ? sendInput.error instanceof Error
      ? isPromptPendingError(sendInput.error) && answerPhase === 'pending'
        ? t('answer.sendPending')
        : sendInput.error.message
      : t('dialog.sendFailedGeneric')
    : null
  const sendErrorMessage = sendInputErrorMessage ?? answerErrorMessage

  // The prompt_pending refusal is server-side and applies to `{ input }` only;
  // `{ keys }` is deliberately not arbitrated there, because Escape and arrow
  // keys are how a picker is dismissed. When the card is gone (closed itself,
  // or the user dismissed it) but the server still refuses text, this is the
  // only way left to get a key to the PTY from the phone (#947). Composer text
  // is never re-routed as keys: prose over an open picker is exactly what the
  // server guard exists to stop.
  const sendEscapeAction =
    sendInput.isError && isPromptPendingError(sendInput.error) && answerPhase !== 'pending'
      ? { label: t('answer.sendEscape'), onPress: () => sendKeys.mutate('\x1b') }
      : null

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
          onAnswerPrompt={handleAnswerPrompt}
          answerPhase={answerPhase}
          answerBusy={answerBusy}
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
        // Send only, and only while the card is answerable. A pending ghost
        // blocks nothing, so an answer the server never confirms cannot strand
        // the composer — which is what makes the five exits from `active` a
        // safety net rather than the only thing standing between the user and
        // a locked app.
        sendDisabled={answerPhase === 'active'}
        onAttach={handleAttach}
        attachments={attachments}
        onRemoveAttachment={removeAttachment}
        isUploading={isUploading}
        attachError={attachError}
        sendError={sendErrorMessage}
        sendErrorAction={sendEscapeAction}
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
