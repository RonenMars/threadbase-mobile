import React from 'react'
import { Alert, View, Text, StyleSheet } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { useTranslation } from 'react-i18next'
import { useTerminalStream } from '@/hooks/useTerminalStream'
import { useSessionActions } from '@/hooks/useSessionActions'
import { useComposerState } from '@/hooks/useComposerState'
import { useActiveQuestion } from '@/hooks/useActiveQuestion'
import { TerminalOutput } from '@/components/terminal/TerminalOutput'
import { ChatComposer } from '@/components/conversation/ChatComposer'
import { SlashCommandBoard } from '@/components/shared/SlashCommandBoard'
import { SlashCommandArgModal } from '@/components/shared/SlashCommandArgModal'
import { PromptQueueSheet } from '@/components/queue/PromptQueueSheet'
import { PlanPreviewSheet } from '@/components/queue/PlanPreviewSheet'
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
}

export function TerminalView({
  serverId,
  sessionId,
  provider,
  parseConfidence: parseConfidenceProp,
  disabled = false,
  pendingPlan = null,
  onClosePlan,
}: Props) {
  const { t } = useTranslation('terminal')
  const { lines, isStreaming, userMessageTexts, parseConfidence } = useTerminalStream(
    serverId,
    sessionId,
    false,
    provider,
  )
  const confidence = parseConfidenceProp ?? parseConfidence
  const { sendInput, sendKeys, respondToQuestion } = useSessionActions(serverId, sessionId)
  const { question: activeQuestion } = useActiveQuestion(serverId, sessionId)

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
          <Text style={styles.rawNoteText}>{t('session.rawModeNote')}</Text>
        </View>
      ) : null}
      <TerminalOutput
        lines={lines}
        isStreaming={isStreaming}
        userMessageTexts={userMessageTexts}
        onSendInput={(text) => sendInput.mutate(text)}
        onSendKeys={(keys) => sendKeys.mutate(keys)}
        activeQuestion={activeQuestion}
        onAnswer={(toolUseId, answers) => respondToQuestion.mutate({ toolUseId, answers })}
      />
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

const styles = StyleSheet.create({
  rawNote: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#21262d',
    borderBottomWidth: 1,
    borderBottomColor: '#30363d',
  },
  rawNoteText: {
    color: '#d29922',
    fontSize: 11,
    lineHeight: 15,
  },
})
