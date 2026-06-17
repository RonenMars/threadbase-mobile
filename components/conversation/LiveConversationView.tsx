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

export function LiveConversationView({ serverId, sessionId, conversationId }: Props) {
  const { t } = useTranslation('terminal')
  const theme = useTheme()
  const styles = makeStyles(theme)
  const listRef = useRef<FlashListRef<Message>>(null)
  const [inputText, setInputText] = useState('')

  // Historical messages (REST)
  const { data } = useConversation(serverId, conversationId)
  const historicalMessages: Message[] = data?.messages ?? []

  // Live appended messages (WS)
  const { liveMessages } = useConversationStream(serverId, sessionId, conversationId)

  // Deduplicate: live messages may duplicate the last REST-fetched message
  const seenIds = new Set(historicalMessages.map((m) => m.id))
  const newLive = liveMessages.filter((m) => !seenIds.has(m.id))
  const allMessages = [...historicalMessages, ...newLive]

  const { sendInput } = useSessionActions(serverId, sessionId)

  const handleSend = () => {
    const text = inputText.trim()
    if (!text) return
    setInputText('')
    sendInput.mutate(text)
  }

  // Auto-scroll to bottom on new live message
  useEffect(() => {
    if (newLive.length > 0) {
      listRef.current?.scrollToEnd({ animated: true })
    }
  }, [newLive.length])

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
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={!inputText.trim()}>
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
