import React, { useCallback, useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Alert, StyleSheet } from 'react-native'
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import * as Haptics from 'expo-haptics'
import { useConversation } from '@/hooks/useConversations'
import { useConversationStream } from '@/hooks/useConversationStream'
import { useSessionActions } from '@/hooks/useSessionActions'
import { useSessionDetail } from '@/hooks/useSession'
import { useTerminalStream } from '@/hooks/useTerminalStream'
import { useComposerState } from '@/hooks/useComposerState'
import { MessageItem } from '@/components/conversation/MessageItem'
import { ThinkingBubble } from '@/components/conversation/ThinkingBubble'
import { ChatComposer } from '@/components/conversation/ChatComposer'
import { SlashCommandBoard } from '@/components/shared/SlashCommandBoard'
import { SlashCommandArgModal } from '@/components/shared/SlashCommandArgModal'
import { PromptQueueSheet } from '@/components/queue/PromptQueueSheet'
import { PlanPreviewSheet } from '@/components/queue/PlanPreviewSheet'
import { wsManager } from '@/services/ws-client'
import type { Message } from '@/types/api'
import { useTheme } from '@/contexts/ThemeContext'
import { type Theme } from '@/constants/theme'

interface Props {
  serverId: string
  sessionId: string
  conversationId: string
  /** Disable the composer while the session's PTY is still waking up. */
  disabled?: boolean
  /** Plan to preview, surfaced from the session screen's plan_ready listener. */
  pendingPlan?: string | null
  onClosePlan?: () => void
}

// Concatenate a user message's text blocks for echo matching.
function userMessageText(m: Message): string {
  return m.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
}

let optimisticSeq = 0
function makeOptimisticMessage(text: string): Message {
  optimisticSeq += 1
  return {
    id: `optimistic-${optimisticSeq}`,
    uuid: null,
    role: 'user',
    content: [{ type: 'text', text }],
    timestamp: '',
    is_sidechain: false,
    parent_uuid: null,
  }
}

export function LiveConversationView({
  serverId,
  sessionId,
  conversationId,
  disabled = false,
  pendingPlan = null,
  onClosePlan,
}: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const listRef = useRef<FlashListRef<Message>>(null)

  // Optimistic user turns: shown immediately on send so the bubble doesn't
  // wait for the JSONL to round-trip back over the WS. Cleared per id once the
  // matching echo arrives in the historical/live stream (matched on text).
  const [pendingSends, setPendingSends] = useState<Message[]>([])

  // Historical messages (REST)
  const { data } = useConversation(serverId, conversationId)
  const historicalMessages: Message[] = data?.messages ?? []

  // Live appended messages (WS)
  const { liveMessages } = useConversationStream(serverId, sessionId, conversationId)

  // Deduplicate: live messages may duplicate the last REST-fetched message
  const seenIds = new Set(historicalMessages.map((m) => m.id))
  const newLive = liveMessages.filter((m) => !seenIds.has(m.id))
  const streamed = [...historicalMessages, ...newLive]

  // Drop optimistic turns whose echo has already landed in the stream — a user
  // message with the same text. Avoids showing the sent bubble twice.
  const echoedText = new Set(
    streamed
      .filter((m) => m.role === 'user')
      .map((m) => userMessageText(m)),
  )
  const stillPending = pendingSends.filter((m) => !echoedText.has(userMessageText(m)))
  const allMessages = [...streamed, ...stillPending]

  // Session status for thinking indicator
  const { data: session } = useSessionDetail(serverId, sessionId)
  // PTY lines shown inside the thinking bubble while agent is running
  const { lines: ptyLines, isStreaming } = useTerminalStream(serverId, sessionId)

  // Show thinking bubble when session is running and the last real message isn't an assistant reply
  const lastMessage = allMessages[allMessages.length - 1]
  const isAgentThinking =
    session?.status === 'running' && lastMessage?.role !== 'assistant'

  // 'hidden' → 'thinking' (agent running) → 'fading' (agent done) → 'hidden'
  const [thinkingState, setThinkingState] = useState<'hidden' | 'thinking' | 'fading'>('hidden')

  useEffect(() => {
    if (isAgentThinking) {
      setThinkingState('thinking') // eslint-disable-line react-hooks/set-state-in-effect
    } else if (thinkingState === 'thinking') {
      setThinkingState('fading') // eslint-disable-line react-hooks/set-state-in-effect
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAgentThinking])

  const handleFadeOutComplete = useCallback(() => setThinkingState('hidden'), [])

  const { sendInput } = useSessionActions(serverId, sessionId)

  const isConnected = () => wsManager.getClient(serverId)?.status() === 'connected'

  // Append the user's own message optimistically and fire the send. The
  // optimistic bubble shows what the user typed; the payload may also carry
  // attachment @refs.
  const send = (payload: string, optimisticText: string) => {
    if (!isConnected()) {
      Alert.alert('Not connected', 'Waiting for connection — try again in a moment.')
      return
    }
    if (optimisticText) {
      setPendingSends((prev) => [...prev, makeOptimisticMessage(optimisticText)])
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    sendInput.mutate(payload, {
      onError: (err) => Alert.alert('Send failed', err instanceof Error ? err.message : String(err)),
    })
  }

  const {
    inputText,
    handleInputChange,
    handleSend,
    slashBoardVisible,
    setSlashBoardVisible,
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
  } = useComposerState({ serverId, sessionId, onSend: send })

  // Auto-scroll to bottom when a new message appears — a live WS message or
  // the user's own optimistic send.
  useEffect(() => {
    if (allMessages.length > 0) {
      listRef.current?.scrollToEnd({ animated: true })
    }
  }, [allMessages.length])

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlashList
        ref={listRef}
        data={allMessages}
        keyExtractor={(m) => m.id}
        renderItem={({ item, index }) => (
          <MessageItem message={item} isLast={index === allMessages.length - 1} />
        )}
        onLoad={() => listRef.current?.scrollToEnd({ animated: false })}
      />
      {thinkingState !== 'hidden' ? (
        <ThinkingBubble
          lines={ptyLines}
          isStreaming={isStreaming}
          fadingOut={thinkingState === 'fading'}
          onFadeOutComplete={handleFadeOutComplete}
        />
      ) : null}
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

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg.primary },
  })
}
