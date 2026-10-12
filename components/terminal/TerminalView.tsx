import React, { useCallback } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { MagnifyingGlass } from 'phosphor-react-native'
import Reanimated from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useTerminalStream } from '@/hooks/useTerminalStream'
import { useTerminalTranscript } from '@/hooks/useTerminalTranscript'
import { useTheme } from '@/contexts/ThemeContext'
import { font, spacing } from '@/constants/theme'
import { usePromptSuggestion } from '@/hooks/usePromptSuggestion'
import { useSessionActions } from '@/hooks/useSessionActions'
import { useComposerState } from '@/hooks/useComposerState'
import { useFileMentions } from '@/hooks/useFileMentions'
import { useKeyboardInset } from '@/hooks/useKeyboardInset'
import { useQuestionAnswer } from '@/hooks/useQuestionAnswer'
import { useQuestionCancel } from '@/hooks/useQuestionCancel'
import { isPromptPendingError } from '@/services/api-client'
import { TerminalOutput } from '@/components/terminal/TerminalOutput'
import { ChatComposer } from '@/components/conversation/ChatComposer'
import { SlashCommandBoard } from '@/components/shared/SlashCommandBoard'
import { SlashCommandArgModal } from '@/components/shared/SlashCommandArgModal'
import { conversationHref } from '@/lib/conversationHref'
import { markSessionUsed } from '@/lib/sessionUsage'
import type { ProviderName } from '@/constants/providers'

interface Props {
  serverId: string
  sessionId: string
  provider?: ProviderName | string | null
  /** Session cwd on the streamer's machine; `@` mentions list files relative to it. */
  projectPath?: string | null
  disabled?: boolean
  /** The raw-keys row, when open; rides the keyboard with the composer. */
  composerAccessory?: React.ReactNode
  /** Conversation that was resumed into this session — when set, disclose missing PTY scrollback. */
  resumedConversationId?: string | null
  /** Conversation backing this session — its transcript is the terminal's scrollback. */
  conversationId?: string | null
}

export function TerminalView({
  serverId,
  sessionId,
  provider,
  projectPath = null,
  disabled = false,
  composerAccessory = null,
  resumedConversationId = null,
  conversationId = null,
}: Props) {
  const { t } = useTranslation('terminal')
  const theme = useTheme()
  const router = useRouter()
  const leaveToHome = useCallback(() => router.replace('/'), [router])
  const { suggestion, chipSuggestion, dismiss: dismissSuggestion } = usePromptSuggestion(serverId, sessionId)
  const { lines, frameLines, isStreaming, userMessageTexts, prompts } = useTerminalStream(
    serverId,
    sessionId,
    false,
    provider,
    suggestion,
  )
  const { sendInput, sendKeys, sendRawKey, respondToQuestion, answerPermission, answerPrompt } = useSessionActions(serverId, sessionId)
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
  } = useQuestionAnswer({
    serverId,
    sessionId,
    respondToQuestion,
    answerPermission,
    answerPrompt,
    onSessionQuit: leaveToHome,
  })
  const { cancelQuestion, cancelErrorMessage, cancelNoticeMessage } =
    useQuestionCancel({ serverId, activeQuestion, clearQuestion, sendKeys, sendRawKey })

  // Scrollback comes from the transcript, the PTY grid only covers the turn in
  // progress: Claude Code wipes its own scrollback mid-turn, so the join works
  // on the frame drawn since the last clear. Without a conversationId the
  // stream's own kept history is all there is (`lines`), and `transcript`
  // stays empty.
  const { transcript, live, totalMessages, hasOlder, isFetchingOlder, fetchOlder } = useTerminalTranscript({
    serverId,
    sessionId,
    conversationId,
    gridLines: frameLines,
    prompts,
    cardOpen: activeQuestion != null,
  })

  const onSearchHistory = useCallback(() => {
    if (!conversationId) return
    router.push(
      conversationHref(conversationId, serverId, undefined, {
        fromSession: sessionId,
        openSearch: true,
      }),
    )
  }, [conversationId, router, serverId, sessionId])

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
      // above the composer here, so it is in view even with the keyboard up;
      // the server's message shows inline via sendError. No alert: a modal
      // would take the focus this is trying to hand to the card. The rethrow is
      // what keeps the draft — sendAndReset only clears on success.
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
    voice,
    micGranted,
    handleToggleMic,
  } = useComposerState({ serverId, sessionId, onSend })
  const fileMentions = useFileMentions({
    serverId,
    projectPath,
    provider,
    text: inputText,
    onChangeText: handleInputChange,
  })
  const keyboardInset = useKeyboardInset()

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
  const sendErrorMessage = sendInputErrorMessage ?? answerErrorMessage ?? cancelErrorMessage
  const sendNoticeMessage = answerNoticeMessage ?? cancelNoticeMessage
  // message_pagination.total, not what the byte-bounded seed has loaded.
  const historyHeaderText = t('history.header', { count: totalMessages })

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
    <Reanimated.View style={[styles.container, keyboardInset]}>
      {conversationId && totalMessages > 0 ? (
        <View style={[styles.historyHeader, { borderBottomColor: theme.border }]} testID="session-history-header">
          <Text style={[styles.historyLabel, { color: theme.text.secondary }]}>{historyHeaderText}</Text>
          <Pressable
            onPress={onSearchHistory}
            accessibilityRole="button"
            accessibilityLabel={t('history.searchLabel')}
            testID="session-history-search-btn"
            hitSlop={8}
            style={styles.historySearch}
          >
            <MagnifyingGlass size={16} color={theme.text.secondary} />
          </Pressable>
        </View>
      ) : null}
      <View testID="terminal-output-region" style={styles.terminalVisible}>
        <TerminalOutput
          lines={conversationId ? live : lines}
          transcript={transcript}
          hasOlder={hasOlder}
          isFetchingOlder={isFetchingOlder}
          onLoadOlder={fetchOlder}
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
          onCancelQuestion={cancelQuestion}
          onSessionQuit={leaveToHome}
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
        sendNotice={sendNoticeMessage}
        disabled={disabled}
        voice={voice}
        micGranted={micGranted}
        onToggleMic={handleToggleMic}
        promptSuggestion={chipSuggestion}
        onSendSuggestion={(text) => {
          dismissSuggestion()
          handleSend(text)
        }}
        onFillSuggestion={(text) => {
          dismissSuggestion()
          handleInputChange(text)
        }}
        accessory={composerAccessory}
        mention={fileMentions.mention}
        selection={fileMentions.selection}
        onSelectionChange={fileMentions.onSelectionChange}
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


    </Reanimated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  terminalVisible: {
    flex: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  historyLabel: {
    fontSize: font.xs,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  historySearch: {
    padding: spacing.xs,
  },
})
