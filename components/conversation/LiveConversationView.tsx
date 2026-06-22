import React, { useCallback, useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Alert, ScrollView, StyleSheet, Text } from 'react-native'
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import { useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { useConversation } from '@/hooks/useConversations'
import { useConversationStream } from '@/hooks/useConversationStream'
import { useSessionActions } from '@/hooks/useSessionActions'
import { useActiveQuestion } from '@/hooks/useActiveQuestion'
import { useSessionDetail } from '@/hooks/useSession'
import { useTerminalStream } from '@/hooks/useTerminalStream'
import { useComposerState } from '@/hooks/useComposerState'
import { MessageItem } from '@/components/conversation/MessageItem'
import { ThinkingBubble } from '@/components/conversation/ThinkingBubble'
import { stripAnsi } from '@/utils/stripAnsi'
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
  /** Height of UI above this view (header + status bar) so KeyboardAvoidingView offsets correctly. */
  keyboardVerticalOffset?: number
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
  keyboardVerticalOffset = 0,
}: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const listRef = useRef<FlashListRef<Message>>(null)
  const qc = useQueryClient()

  // Optimistic user turns: shown immediately on send so the bubble doesn't
  // wait for the JSONL to round-trip back over the WS. Cleared per id once the
  // matching echo arrives in the historical/live stream (matched on text).
  const [pendingSends, setPendingSends] = useState<Message[]>([])

  // Historical messages (REST)
  const { data } = useConversation(serverId, conversationId)
  const historicalMessages: Message[] = data?.messages ?? []

  // Live appended messages (WS)
  const { liveMessages } = useConversationStream(serverId, sessionId, conversationId)

  // Deduplicate live messages against historical by uuid (not id — REST uses index-based ids
  // while WS uses uuid or timestamp fallback, so id never matches across sources).
  const seenUuids = new Set(historicalMessages.map((m) => m.uuid).filter(Boolean))
  const newLive = liveMessages.filter((m) => !m.uuid || !seenUuids.has(m.uuid))

  // Drop optimistic turns whose echo has landed — matched one-for-one by text.
  const allStreamed = [...historicalMessages, ...newLive]
  const echoedUserTexts = allStreamed.filter((m) => m.role === 'user').map((m) => userMessageText(m))
  const stillPending = (() => {
    const remaining = [...pendingSends]
    for (const echoText of echoedUserTexts) {
      const idx = remaining.findIndex((m) => userMessageText(m) === echoText)
      if (idx !== -1) remaining.splice(idx, 1)
    }
    return remaining
  })()
  // Order: historical → optimistic user bubble → live WS messages.
  // This ensures the user's send always sits before any live assistant reply,
  // even when the WS assistant message arrives before the REST echo clears stillPending.
  const allMessages = [...historicalMessages, ...stillPending, ...newLive]

  // Session status for thinking indicator
  const { data: session } = useSessionDetail(serverId, sessionId)

  // Keep session status fresh: subscribe to WS session_update so the cache
  // updates immediately when the agent finishes (status: running → idle).
  // Without this, useSessionDetail has no refetchInterval and the thinking
  // bubble would stay visible until something else invalidates the query.
  useEffect(() => {
    const client = wsManager.getClient(serverId)
    if (!client) return
    return client.on('session_update', (msg) => {
      if (msg.type !== 'session_update' || msg.session.id !== sessionId) return
      qc.setQueryData(['session', serverId, sessionId], msg.session)
    })
  }, [serverId, sessionId, qc])

  // PTY lines shown inside the thinking bubble while agent is running
  const { lines: ptyLines, isStreaming } = useTerminalStream(serverId, sessionId)

  // Show thinking bubble when session is running and the last real message isn't an assistant reply
  const lastMessage = allMessages[allMessages.length - 1]
  const isAgentThinking =
    (session?.status === 'running' || pendingSends.length > 0)
    && lastMessage?.role !== 'assistant'

  // 'hidden' → 'thinking' (agent running) → 'fading' (agent done) → 'hidden'
  const [thinkingState, setThinkingState] = useState<'hidden' | 'thinking' | 'fading'>('hidden')

  useEffect(() => {
    if (isAgentThinking) {
      setThinkingState('thinking') // eslint-disable-line react-hooks/set-state-in-effect
    } else if (thinkingState === 'thinking') {
      setThinkingState('fading') // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [isAgentThinking, thinkingState])

  const handleFadeOutComplete = useCallback(() => setThinkingState('hidden'), [])

  const { sendInput, sendKeys, respondToQuestion } = useSessionActions(serverId, sessionId)
  const { question: activeQuestion } = useActiveQuestion(serverId, sessionId)

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

  // Auto-scroll to bottom when a new message appears or the thinking bubble shows.
  useEffect(() => {
    if (allMessages.length > 0) {
      listRef.current?.scrollToEnd({ animated: true })
    }
  }, [allMessages.length])

  useEffect(() => {
    if (thinkingState === 'thinking') {
      listRef.current?.scrollToEnd({ animated: true })
    }
  }, [thinkingState])

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'height' : undefined} keyboardVerticalOffset={keyboardVerticalOffset}>
      <FlashList
        ref={listRef}
        data={allMessages}
        keyExtractor={(m) => m.id}
        renderItem={({ item, index }) => (
          <MessageItem message={item} isLast={index === allMessages.length - 1} />
        )}
        onLoad={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          // A freshly-started / waiting_input session has no JSONL yet, so there
          // are no conversation messages (REST) and no conversation_event (WS).
          // The PTY is still streaming live output, though — surface it so the
          // chat isn't blank until the first message lands, then bubbles take over.
          <LivePtyPlaceholder lines={ptyLines} theme={theme} />
        }
        ListFooterComponent={thinkingState !== 'hidden' ? (
          <ThinkingBubble
            lines={ptyLines}
            isStreaming={isStreaming}
            fadingOut={thinkingState === 'fading'}
            onFadeOutComplete={handleFadeOutComplete}
            onSendKeys={(keys) => sendKeys.mutate(keys)}
            activeQuestion={activeQuestion}
            onAnswer={(toolUseId, answers) => respondToQuestion.mutate({ toolUseId, answers })}
          />
        ) : null}
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

// Live PTY output shown while a session has no conversation messages yet
// (fresh / waiting_input session, JSONL not written). Renders nothing until
// the PTY produces output, then yields to message bubbles once any land.
function LivePtyPlaceholder({ lines, theme }: { lines: string[]; theme: Theme }) {
  const visibleLines = lines.slice(-200).map(stripAnsi).filter((l) => l.trim().length > 0)
  if (visibleLines.length === 0) return null
  const styles = makeStyles(theme)
  return (
    <ScrollView style={styles.ptyContainer} contentContainerStyle={styles.ptyContent}>
      {visibleLines.map((line, i) => (
        <Text key={i} style={styles.ptyLine} numberOfLines={1}>
          {line}
        </Text>
      ))}
    </ScrollView>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg.primary },
    ptyContainer: { flex: 1, paddingHorizontal: 12 },
    ptyContent: { paddingVertical: 12 },
    ptyLine: {
      fontFamily: 'monospace',
      fontSize: 11,
      color: theme.text.secondary,
      lineHeight: 16,
    },
  })
}
