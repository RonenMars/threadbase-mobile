import React from 'react'
<<<<<<< HEAD
import { Alert, Platform } from 'react-native'
=======
import { Alert } from 'react-native'
>>>>>>> 5f83d0d2 (fix(keyboard): use react-native-keyboard-controller and safe area padding to prevent input hiding)
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
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

interface Props {
  serverId: string
  sessionId: string
  disabled?: boolean
  pendingPlan?: string | null
  onClosePlan?: () => void
}

export function TerminalView({ serverId, sessionId, disabled = false, pendingPlan = null, onClosePlan }: Props) {
  const { lines, isStreaming } = useTerminalStream(serverId, sessionId)
  const { sendInput, sendKeys, respondToQuestion } = useSessionActions(serverId, sessionId)
  const { question: activeQuestion } = useActiveQuestion(serverId, sessionId)

  const onSend = (payload: string) => {
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TerminalOutput
        lines={lines}
        isStreaming={isStreaming}
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
