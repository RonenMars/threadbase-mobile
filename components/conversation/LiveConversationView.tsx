import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View, TextInput, TouchableOpacity, Text, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import { useConversation } from '@/hooks/useConversations'
import { useConversationStream } from '@/hooks/useConversationStream'
import { useSessionActions } from '@/hooks/useSessionActions'
import { MessageItem } from '@/components/conversation/MessageItem'
import type { Message } from '@/types/api'
import { useTheme } from '@/contexts/ThemeContext'
import { spacing, type Theme } from '@/constants/theme'

interface Props {
  serverId: string
  sessionId: string
  conversationId: string
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

export function LiveConversationView({ serverId, sessionId, conversationId }: Props) {
  const { t } = useTranslation('terminal')
  const theme = useTheme()
  const styles = makeStyles(theme)
  const listRef = useRef<FlashListRef<Message>>(null)
  const [inputText, setInputText] = useState('')
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

  const { sendInput } = useSessionActions(serverId, sessionId)

  const handleSend = () => {
    const text = inputText.trim()
    if (!text) return
    setInputText('')
    setPendingSends((prev) => [...prev, makeOptimisticMessage(text)])
    sendInput.mutate(text)
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
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder={t('input.placeholder')}
          placeholderTextColor={theme.text.secondary}
          multiline
          returnKeyType="send"
          onSubmitEditing={handleSend}
          testID="chat-message-input"
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={!inputText.trim()} testID="chat-send-button">
          <Text style={styles.sendButtonText}>{t('input.send')}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg.primary },
    inputRow: {
      flexDirection: 'row',
      padding: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      alignItems: 'flex-end',
    },
    input: {
      flex: 1,
      minHeight: 40,
      maxHeight: 120,
      paddingHorizontal: spacing.sm,
      color: theme.text.primary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 20,
      paddingTop: 10,
      paddingBottom: 10,
    },
    sendButton: {
      marginLeft: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: theme.text.accent,
      borderRadius: 20,
    },
    sendButtonText: { color: theme.text.onAccent, fontWeight: '600' },
  })
}
