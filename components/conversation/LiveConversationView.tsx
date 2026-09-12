import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  Keyboard,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import Reanimated from 'react-native-reanimated'
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import { useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useConversation } from '@/hooks/useConversations'
import { useConversationStream } from '@/hooks/useConversationStream'
import { useSessionActions } from '@/hooks/useSessionActions'
import { useQuestionAnswer } from '@/hooks/useQuestionAnswer'
import { useQuestionCancel } from '@/hooks/useQuestionCancel'
import { isPromptPendingError } from '@/services/api-client'
import { useSessionDetail } from '@/hooks/useSession'
import { useTerminalStream } from '@/hooks/useTerminalStream'
import { useComposerState } from '@/hooks/useComposerState'
import { useKeyboardInset } from '@/hooks/useKeyboardInset'
import { MessageItem } from '@/components/conversation/MessageItem'
import { HistoryLoadBoundary } from '@/components/conversation/HistoryLoadBoundary'
import { InheritedHistoryDivider } from '@/components/conversation/InheritedHistoryDivider'
import { ThinkingBubble } from '@/components/conversation/ThinkingBubble'
import { stripAnsi } from '@/utils/stripAnsi'
import { stripBoxDrawing } from '@/utils/stripBoxDrawing'
import { mergeLiveMessages } from '@/utils/mergeLiveMessages'
import { ChatComposer } from '@/components/conversation/ChatComposer'
import { SlashCommandBoard } from '@/components/shared/SlashCommandBoard'
import { SlashCommandArgModal } from '@/components/shared/SlashCommandArgModal'
import { PromptQueueSheet } from '@/components/queue/PromptQueueSheet'
import { wsManager } from '@/services/ws-client'
import { markSessionUsed } from '@/lib/sessionUsage'
import type { Message } from '@/types/api'
import { useTheme } from '@/contexts/ThemeContext'
import { spacing, type Theme } from '@/constants/theme'
import type { ProviderName } from '@/constants/providers'
import { preferRawTerminal } from '@/lib/renderConfidence'
import { deriveSessionPresentation } from '@/lib/sessionPresentation'
import { RenderErrorBoundary } from '@/components/RenderErrorBoundary'
import { SESSION_HISTORY_MAX_BYTES } from '@/constants/sessionHistory'
import { useInitialScrollToEnd } from '@/hooks/useInitialScrollToEnd'
import { CaretDown } from 'phosphor-react-native'

interface Props {
  serverId: string
  sessionId: string
  conversationId: string
  provider?: ProviderName | string | null
  /** Disable the composer while the session's PTY is still waking up. */
  disabled?: boolean
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

// FlashList v2 owns the chat bottom-anchoring. This object is a module
// constant and the list is NEVER switched to `{ disabled: true }`: with the
// threshold gone, flash-list's checkBounds stops clearing its sticky
// `pendingAutoscrollToBottom` flag (useBoundDetection.ts), which stays latched
// `true` from when the user was last at the tail — and the next `data` change
// fires a scrollToEnd, snapping the user back to the bottom mid-drag. The
// threshold alone already is the follow rule: near the tail → follow, scrolled
// up → don't.
const CHAT_ANCHOR = { autoscrollToBottomThreshold: 0.2, startRenderingFromBottom: true } as const

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
  onPreferRawTerminal,
}: Props) {
  const theme = useTheme()
  const { t } = useTranslation('conversation')
  const { t: tTerminal } = useTranslation('terminal')
  const styles = makeStyles(theme)
  const listRef = useRef<FlashListRef<Message>>(null)
  const { stickToEnd, releasePin } = useInitialScrollToEnd(listRef, true)
  const qc = useQueryClient()
  const router = useRouter()
  const leaveToHome = useCallback(() => router.replace('/'), [router])
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const keyboardInset = useKeyboardInset()

  // Optimistic user turns: shown immediately on send so the bubble doesn't
  // wait for the JSONL to round-trip back over the WS. Cleared per id once the
  // matching echo arrives in the historical/live stream (matched on text).
  const [pendingSends, setPendingSends] = useState<Message[]>([])

  // Historical messages (REST). Bounded by SESSION_HISTORY_MAX_BYTES so a huge
  // conversation doesn't seed the whole heap on open — the rest pages in on
  // backward scroll via onStartReached below (see docs/superpowers/specs/
  // 2026-08-15-session-history-byte-budget-design.md).
  const { data, isLoading: isHistoryLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useConversation(serverId, conversationId, {
    maxBytes: SESSION_HISTORY_MAX_BYTES,
  })
  const historicalMessages: Message[] = data?.messages ?? []
  const inheritedHistory = data?.inheritedHistory
  // Matched against the rendered rows, so the seam appears as soon as the page
  // carrying the boundary message loads.
  const forkSeam = inheritedHistory?.kind === 'divider' ? inheritedHistory : undefined

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
  const { lines: ptyLines, isStreaming, parseConfidence } = useTerminalStream(
    serverId,
    sessionId,
    false,
    provider,
  )

  useEffect(() => {
    // A resumed session's PTY replay lands immediately while REST history is
    // still in flight, so allMessages.length reads 0 the same way a genuinely
    // empty chat would. Wait for history to settle before trusting "0
    // messages" as a real chat_empty_pty_active signal — otherwise this fires
    // on the loading race, not on an actual parse problem, and forceRawTerminal
    // has no way back.
    if (isHistoryLoading) return
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
  }, [isHistoryLoading, allMessages.length, ptyLines.length, parseConfidence, onPreferRawTerminal])

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

  // Phase comes gated on `presentation.live` — never re-derive liveness here.
  const agentPhase = session ? deriveSessionPresentation(session).subStatus : null

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

  // A question arrives on the running → waiting_input edge, which is exactly the
  // edge that retires the thinking bubble. Mount on the question too, or a card
  // that lands a beat later has no host left to render in.
  const showThinkingFooter = activeQuestion !== null || thinkingState !== 'hidden'


  // Await, then transition. The card stays exactly where it is until the server
  // has taken the answer, so a tap on a gate that has already closed clears the
  // card with a calm notice instead of leaving it up and tappable — the server
  // has just said the gate is not open, so a second tap cannot succeed either.
  //
  // Classified by code, never by status class. Only the three closed reasons
  // clear; anything else keeps the card so the user can try again. Two of those
  // three arrive with no `permission_cancelled` alongside them, which makes this
  // the only thing that takes the card down for them.

  const isConnected = () => wsManager.getClient(serverId)?.status() === 'connected'

  // Append the user's own message optimistically and fire the send. The
  // optimistic bubble shows what the user typed; the payload may also carry
  // attachment @refs. Composer text/attachments stay until this resolves —
  // a failed send must not wipe what the user typed.
  const send = async (payload: string, optimisticText: string) => {
    if (!isConnected()) {
      Alert.alert(t('connection.notConnectedTitle'), t('connection.notConnectedMessage'))
      throw new Error('not-connected')
    }
    markSessionUsed(sessionId)
    let optimisticId: string | undefined
    if (optimisticText) {
      const msg = makeOptimisticMessage(optimisticText)
      optimisticId = msg.id
      setPendingSends((prev) => [...prev, msg])
    }
    try {
      await sendInput.mutateAsync(payload)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (err) {
      if (optimisticId) {
        setPendingSends((prev) => prev.filter((m) => m.id !== optimisticId))
      }
      // A prompt is open and the server refused the text. The card is the
      // list footer, so jump back to it (the composer already dropped the
      // keyboard on send); the server's message shows inline via sendError.
      // No alert: a modal would take the focus this is trying to hand to the
      // card. The rethrow keeps the draft.
      if (isPromptPendingError(err instanceof Error ? err : null)) {
        jumpToLatest()
        throw err
      }
      Alert.alert(tTerminal('dialog.sendFailedTitle'), err instanceof Error ? err.message : String(err))
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
  } = useComposerState({ serverId, sessionId, onSend: send })

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
        ? tTerminal('answer.sendPending')
        : sendInput.error.message
      : tTerminal('dialog.sendFailedGeneric')
    : null
  const sendErrorMessage = sendInputErrorMessage ?? answerErrorMessage ?? cancelErrorMessage
  const sendNoticeMessage = answerNoticeMessage ?? cancelNoticeMessage

  // The prompt_pending refusal is server-side and applies to `{ input }` only;
  // `{ keys }` is deliberately not arbitrated there, because Escape and arrow
  // keys are how a picker is dismissed. When the card is gone (closed itself,
  // or the user dismissed it) but the server still refuses text, this is the
  // only way left to get a key to the PTY from the phone (#947/#948). Mirrors
  // TerminalView's sendEscapeAction — this tab hits the same refusal.
  const sendEscapeAction =
    sendInput.isError && isPromptPendingError(sendInput.error) && answerPhase !== 'pending'
      ? { label: tTerminal('answer.sendEscape'), onPress: () => sendKeys.mutate('\x1b') }
      : null

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

  const jumpToLatest = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true })
    setShowJumpToLatest(false)
  }, [])

  // Drives the jump-to-latest FAB only — same rule as ConversationHistoryList.
  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
    setShowJumpToLatest(contentSize.height - contentOffset.y - layoutMeasurement.height > 100)
  }, [])

  return (
    <Reanimated.View style={[styles.container, keyboardInset]}>
      <FlashList
        ref={listRef}
        testID="live-conversation-list"
        data={allMessages}
        keyExtractor={(m) => m.id}
        renderItem={({ item, index }) => (
          <>
            {forkSeam && item.messageIndex === forkSeam.beforeMessageIndex ? (
              <InheritedHistoryDivider seam={forkSeam} />
            ) : null}
            <RenderErrorBoundary
              tag="message_item"
              rawFallback={userMessageText(item) || item.role}
            >
              <MessageItem message={item} isLast={index === allMessages.length - 1} />
            </RenderErrorBoundary>
          </>
        )}
        maintainVisibleContentPosition={CHAT_ANCHOR}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onLoad={stickToEnd}
        onContentSizeChange={stickToEnd}
        onScrollBeginDrag={releasePin}
        onStartReached={hasNextPage ? fetchNextPage : undefined}
        onStartReachedThreshold={0.3}
        ListHeaderComponent={
          <>
            {inheritedHistory?.kind === 'unavailable' ? (
              <InheritedHistoryDivider seam={inheritedHistory} />
            ) : null}
            <HistoryLoadBoundary hasOlder={Boolean(hasNextPage)} isFetching={isFetchingNextPage} />
          </>
        }
        ListEmptyComponent={
          // A freshly-started / waiting_input session has no JSONL yet, so there
          // are no conversation messages (REST) and no conversation_event (WS).
          // The PTY is still streaming live output, though — surface it so the
          // chat isn't blank until the first message lands, then bubbles take over.
          <LivePtyPlaceholder lines={ptyLines} theme={theme} />
        }
        ListFooterComponent={showThinkingFooter ? (
          <ThinkingBubble
            lines={ptyLines}
            isStreaming={isStreaming}
            fadingOut={thinkingState === 'fading'}
            onFadeOutComplete={handleFadeOutComplete}
            onSendKeys={(keys) => sendKeys.mutate(keys)}
            activeQuestion={activeQuestion}
            subStatus={agentPhase}
            onAnswer={handleAnswerQuestion}
            onAnswerPermission={handleAnswerPermission}
            onAnswerPrompt={handleAnswerPrompt}
            answerPhase={answerPhase}
            answerBusy={answerBusy}
            onCancelQuestion={cancelQuestion}
            onSessionQuit={leaveToHome}
          />
        ) : null}
      />
      {showJumpToLatest ? (
        <TouchableOpacity
          style={styles.jumpToLatest}
          onPress={jumpToLatest}
          accessibilityLabel={t('action.scrollToBottom')}
          accessibilityRole="button"
          testID="chat-jump-to-latest"
        >
          <CaretDown size={20} color="#fff" weight="bold" />
        </TouchableOpacity>
      ) : null}
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

    </Reanimated.View>
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
    ptyContainer: { flex: 1, paddingHorizontal: 12 },
    ptyContent: { paddingVertical: 12 },
    ptyLine: {
      fontFamily: 'monospace',
      fontSize: 11,
      color: theme.text.secondary,
      lineHeight: 16,
    },
    jumpToLatest: {
      position: 'absolute',
      end: spacing.md,
      bottom: spacing.md,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.text.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    },
  })
}
