import React, { useCallback, useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Alert, Linking, AppState, StyleSheet } from 'react-native'
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import * as Haptics from 'expo-haptics'
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition'
import { useConversation } from '@/hooks/useConversations'
import { useConversationStream } from '@/hooks/useConversationStream'
import { useSessionActions } from '@/hooks/useSessionActions'
import { useVoiceInput } from '@/hooks/useVoiceInput'
import { useRenameSession } from '@/hooks/useSessionName'
import { MessageItem } from '@/components/conversation/MessageItem'
import { ChatComposer } from '@/components/conversation/ChatComposer'
import { SlashCommandBoard } from '@/components/shared/SlashCommandBoard'
import { SlashCommandArgModal } from '@/components/shared/SlashCommandArgModal'
import { PromptQueueSheet } from '@/components/queue/PromptQueueSheet'
import { PlanPreviewSheet } from '@/components/queue/PlanPreviewSheet'
import { wsManager } from '@/services/ws-client'
import {
  pickFromCamera,
  pickFromLibraryMulti,
  pickFromFiles,
  uploadAttachment,
  type UploadedFile,
} from '@/services/uploads'
import { useDraftsStore } from '@/stores/drafts'
import { useSettingsStore } from '@/stores/settings'
import { useSessionNamesStore } from '@/stores/sessionNames'
import type { SlashCommand } from '@/constants/slashCommands'
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

  const [inputText, setInputText] = useState('')
  const [attachments, setAttachments] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const [slashBoardVisible, setSlashBoardVisible] = useState(false)
  const [pendingArgCommand, setPendingArgCommand] = useState<SlashCommand | null>(null)
  const [queueVisible, setQueueVisible] = useState(false)
  // Optimistic user turns: shown immediately on send so the bubble doesn't
  // wait for the JSONL to round-trip back over the WS. Cleared per id once the
  // matching echo arrives in the historical/live stream (matched on text).
  const [pendingSends, setPendingSends] = useState<Message[]>([])

  const setDraft = useDraftsStore((s) => s.setDraft)
  const clearDraft = useDraftsStore((s) => s.clearDraft)
  const hydrateDrafts = useDraftsStore((s) => s.hydrate)
  const getName = useSessionNamesStore((s) => s.getName)
  const { autoNameFromMessage } = useSettingsStore()
  const renameSession = useRenameSession(serverId)

  const voice = useVoiceInput({
    onTranscript: (text) => setInputText(text),
    contextualStrings: ['React', 'TypeScript', 'useEffect', 'Expo', 'TSX', 'Claude'],
  })
  const [micGranted, setMicGranted] = useState(false)
  const checkMicPermission = useCallback(async () => {
    const { granted } = await ExpoSpeechRecognitionModule.getPermissionsAsync()
    setMicGranted(granted)
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void checkMicPermission() }, [checkMicPermission])
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') checkMicPermission()
    })
    return () => sub.remove()
  }, [checkMicPermission])

  // Hydrate any saved draft for this session.
  useEffect(() => {
    hydrateDrafts().then(() => {
      const draft = useDraftsStore.getState().getDraft(serverId, sessionId)
      if (draft) setInputText(draft)
    })
  }, [serverId, sessionId, hydrateDrafts])

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

  const { sendInput } = useSessionActions(serverId, sessionId)

  const isConnected = () => wsManager.getClient(serverId)?.status() === 'connected'

  const resetComposer = () => {
    setInputText('')
    setAttachments([])
    setAttachError(null)
    clearDraft(serverId, sessionId)
  }

  // Build the wire payload: attachment @refs joined with the trimmed text.
  const buildPayload = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed && attachments.length === 0) return null
    const refs = attachments.map((a) => `@${a.path}`).join(' ')
    return refs && trimmed ? `${refs} ${trimmed}` : refs || trimmed
  }

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

  const handleSend = () => {
    const text = inputText.trim()
    const payload = buildPayload(text)
    if (!payload) return
    // Auto-name from the first message.
    if (autoNameFromMessage && !getName(serverId, sessionId)) {
      const autoName = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20)
      if (autoName) renameSession.mutate({ sessionId, name: autoName, origin: 'auto' })
    }
    send(payload, text || payload)
    resetComposer()
  }

  const handleInputChange = (text: string) => {
    setInputText(text)
    setDraft(serverId, sessionId, text)
    setSlashBoardVisible(/^\/.{0,30}$/.test(text))
  }

  const handleSlashCommandSelect = (command: SlashCommand) => {
    setSlashBoardVisible(false)
    if (command.needsArgs) {
      setInputText('')
      setPendingArgCommand(command)
      return
    }
    const payload = `/${command.id}`
    send(payload, payload)
    resetComposer()
  }

  const handleSlashArgConfirm = (command: SlashCommand, arg: string) => {
    setPendingArgCommand(null)
    const payload = `/${command.id} ${arg}`
    send(payload, payload)
    resetComposer()
  }

  const runUpload = async (source: 'camera' | 'library' | 'files') => {
    setAttachError(null)
    try {
      let images: Awaited<ReturnType<typeof pickFromLibraryMulti>>
      if (source === 'camera') {
        const single = await pickFromCamera()
        if (!single) return
        images = [single]
      } else if (source === 'library') {
        images = await pickFromLibraryMulti()
        if (images.length === 0) return
      } else {
        images = await pickFromFiles()
        if (images.length === 0) return
      }
      setIsUploading(true)
      const uploaded = await Promise.all(images.map((img) => uploadAttachment(serverId, sessionId, img)))
      setAttachments((prev) => [...prev, ...uploaded])
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : 'Failed to attach file')
    } finally {
      setIsUploading(false)
    }
  }

  const handleAttach = () => {
    if (isUploading) return
    Alert.alert('Attach', undefined, [
      { text: 'Take Photo', onPress: () => runUpload('camera') },
      { text: 'Choose from Gallery', onPress: () => runUpload('library') },
      { text: 'Choose Files', onPress: () => runUpload('files') },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const removeAttachment = (attachmentId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
  }

  const handleToggleMic = async () => {
    if (voice.listening) return voice.stop()
    try {
      await voice.start()
      setMicGranted(true)
    } catch (err) {
      if (err instanceof Error && err.message === 'PERMISSION_DENIED') {
        setMicGranted(false)
        Alert.alert('Microphone access needed', 'Enable microphone access in Settings to dictate.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ])
      }
    }
  }

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
        onDismiss={() => {
          setSlashBoardVisible(false)
          setInputText('')
        }}
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
