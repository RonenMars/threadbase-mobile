import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, View, Keyboard } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
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
import { stripBoxDrawing } from '@/utils/stripBoxDrawing'
import { mergeLiveMessages } from '@/utils/mergeLiveMessages'
import { ChatComposer } from '@/components/conversation/ChatComposer'
import { SlashCommandBoard } from '@/components/shared/SlashCommandBoard'
import { SlashCommandArgModal } from '@/components/shared/SlashCommandArgModal'
import { PromptQueueSheet } from '@/components/queue/PromptQueueSheet'
import { PlanPreviewSheet } from '@/components/queue/PlanPreviewSheet'
import { wsManager } from '@/services/ws-client'
import { markSessionUsed } from '@/lib/sessionUsage'
import type { Message } from '@/types/api'
import { useTheme } from '@/contexts/ThemeContext'
import { spacing, type Theme } from '@/constants/theme'
import type { ProviderName } from '@/constants/providers'
import { preferRawTerminal } from '@/lib/renderConfidence'
import { RenderErrorBoundary } from '@/components/RenderErrorBoundary'

interface Props {
  serverId: string
  sessionId: string
  conversationId: string
  provider?: ProviderName | string | null
  /** Disable the composer while the session's PTY is still waking up. */
  disabled?: boolean
  /** Plan to preview, surfaced from the session screen's plan_ready listener. */
  pendingPlan?: string | null
  onClosePlan?: () => void
  /** Prefer raw terminal when chat normalization looks unreliable. */
  onPreferRawTerminal?: () => void
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
  provider,
  disabled = false,
  pendingPlan = null,
  onClosePlan,
  onPreferRawTerminal,
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
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useConversation(serverId, conversationId)
  const historicalMessages: Message[] = data?.messages ?? []

  // Live appended messages (WS)
  const { liveMessages } = useConversationStream(serverId, sessionId, conversationId)

  // Historical carries a server message_index; live WS messages do not (yet —
  // real indexes arrive with the WS-resume follow-up). Order historical by
  // index; live messages keep arrival order after history. Never assign a
  // synthetic index to a live message and never write one back to the query
  // cache — the derived cursor must stay "max index over server-indexed
  // messages" so it can't be advanced by a client-guessed value.
  const orderedHistorical = [...historicalMessages].sort((a, b) => {
    const ai = a.messageIndex ?? Number.MAX_SAFE_INTEGER
    const bi = b.messageIndex ?? Number.MAX_SAFE_INTEGER
    return ai - bi
  })

  // Deduplicate live messages against historical by uuid (id never matches
  // across REST/WS: REST uses index-based ids, WS uses uuid/timestamp).
  const seenUuids = new Set(orderedHistorical.map((m) => m.uuid).filter(Boolean))
  const newLive = liveMessages.filter((m) => !m.uuid || !seenUuids.has(m.uuid))

  // Drop optimistic turns whose echo has landed — matched one-for-one by text.
  const allStreamed = [...orderedHistorical, ...newLive]
  const echoedUserTexts = allStreamed.filter((m) => m.role === 'user').map((m) => userMessageText(m))
  const stillPending = (() => {
    const remaining = [...pendingSends]
    for (const echoText of echoedUserTexts) {
      const idx = remaining.findIndex((m) => userMessageText(m) === echoText)
      if (idx !== -1) remaining.splice(idx, 1)
    }
    return remaining
  })()

  // Order: historical → optimistic user bubble → live WS messages. Dedup by
  // uuid then id (shared with the read-only conversation view). newLive above is
  // recomputed inside the helper — kept local here only for the echo matching.
  const allMessages = mergeLiveMessages(orderedHistorical, liveMessages, stillPending)

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

  // A session_update emitted while the app is backgrounded (socket
  // suspended) is lost forever — reconnect re-auths but never replays it.
  // Refetch on every reconnect so a missed status flip (e.g. running → idle
  // while backgrounded) doesn't strand the thinking bubble indefinitely.
  useEffect(() => {
    return wsManager.onStatusChange(serverId, (s) => {
      if (s === 'connected') {
        qc.invalidateQueries({ queryKey: ['session', serverId, sessionId] })
      }
    })
  }, [serverId, sessionId, qc])

  // PTY lines shown inside the thinking bubble while agent is running
  const { lines: ptyLines, isStreaming, subStatus, parseConfidence } = useTerminalStream(
    serverId,
    sessionId,
    false,
    provider,
  )

  useEffect(() => {
    const decision = preferRawTerminal({
      sessionView: 'chat',
      hasConversationId: true,
      conversationMessageCount: allMessages.length,
      ptyVisibleLineCount: ptyLines.length,
      parseConfidence,
    })
    if (decision.mode === 'terminal' && !decision.chatAuthoritative) {
      onPreferRawTerminal?.()
    }
  }, [allMessages.length, ptyLines.length, parseConfidence, onPreferRawTerminal])

  // Show thinking bubble whenever the session is running. Mid-turn assistant
  // messages (interim replies, sub-agent dispatches) land while Claude is
  // still working — gating on "last message isn't assistant" hid the bubble
  // for the rest of the turn, so long sub-agent runs showed no activity at
  // all. The running → waiting_input flip is what ends the turn.
  // The last-message gate stays only for the optimistic-send window, where
  // status can lag behind the echo.
  const lastMessage = allMessages[allMessages.length - 1]
  const isAgentThinking =
    session?.status === 'running'
    || (pendingSends.length > 0 && lastMessage?.role !== 'assistant')

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
    markSessionUsed(sessionId)
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

  // Auto-scroll to bottom when keyboard opens or app resumes with keyboard already up.
  // New-message/thinking-bubble scrolling is left to FlashList's native
  // maintainVisibleContentPosition bottom-anchoring below — a JS scrollToEnd
  // fired from an effect races FlashList's cell measurement for the new row,
  // landing short until a manual scroll forces a re-layout (see
  // ConversationHistoryList's comment on this same hand-rolled machinery).
  useEffect(() => {
    const onShow = () => listRef.current?.scrollToEnd({ animated: true })
    const subShow = Keyboard.addListener('keyboardDidShow', onShow)
    const subChange = Keyboard.addListener('keyboardDidChangeFrame', onShow)
    return () => { subShow.remove(); subChange.remove() }
  }, [])

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding" automaticOffset>
      <FlashList
        ref={listRef}
        data={allMessages}
        keyExtractor={(m) => m.id}
        renderItem={({ item, index }) => (
          <RenderErrorBoundary
            tag="message_item"
            rawFallback={userMessageText(item) || item.role}
          >
            <MessageItem message={item} isLast={index === allMessages.length - 1} />
          </RenderErrorBoundary>
        )}
        maintainVisibleContentPosition={{ autoscrollToBottomThreshold: 0.2, startRenderingFromBottom: true }}
        onLoad={() => listRef.current?.scrollToEnd({ animated: false })}
        onStartReached={hasNextPage ? fetchNextPage : undefined}
        onStartReachedThreshold={0.3}
        ListHeaderComponent={
          isFetchingNextPage ? (
            <View style={styles.pageLoading}>
              <ActivityIndicator color={theme.text.secondary} />
            </View>
          ) : null
        }
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
            subStatus={subStatus}
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
  const visibleLines = lines
    .slice(-200)
    .map((l) => stripBoxDrawing(stripAnsi(l)))
    .filter((l) => l.length > 0)
  if (visibleLines.length === 0) return null
  const styles = makeStyles(theme)
  return (
    <FlashList
      data={visibleLines}
      keyExtractor={(item, index) => `${index}:${item.slice(0, 24)}`}
      renderItem={({ item }) => (
        <Text style={styles.ptyLine} numberOfLines={1}>
          {item}
        </Text>
      )}
      style={styles.ptyContainer}
      contentContainerStyle={styles.ptyContent}
    />
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg.primary },
    pageLoading: {
      paddingVertical: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
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
