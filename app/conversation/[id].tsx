import React, { useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Share } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { FlashList } from '@shopify/flash-list'
import { useMutation } from '@tanstack/react-query'
import { MessageBubble } from '@/components/conversation/MessageBubble'
import { ToolCard } from '@/components/conversation/ToolCard'
import { DiffViewer } from '@/components/conversation/DiffViewer'
import { useConversation } from '@/hooks/useConversations'
import { api } from '@/services/api-client'
import { dark, font, spacing } from '@/constants/theme'
import type { Message, MessageContent } from '@/types/api'
import { useEffect } from 'react'

function renderContent(block: MessageContent, index: number) {
  if (block.type === 'tool_use' || block.type === 'tool_result') {
    return <ToolCard key={index} block={block} />
  }
  if (block.type === 'diff') {
    return <DiffViewer key={index} filename={block.filename} hunks={block.hunks} />
  }
  return null
}

function MessageItem({ message }: { message: Message }) {
  const hasToolOrDiff = message.content.some(
    (b) => b.type === 'tool_use' || b.type === 'tool_result' || b.type === 'diff'
  )

  if (hasToolOrDiff) {
    return (
      <View style={styles.toolContainer}>
        {message.content.map((block, i) => {
          if (block.type === 'text') {
            return <MessageBubble key={i} message={{ ...message, content: [block] }} />
          }
          return renderContent(block, i)
        })}
      </View>
    )
  }

  return <MessageBubble message={message} />
}

export default function ConversationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const navigation = useNavigation()
  const router = useRouter()
  const { data: conversation, isLoading } = useConversation(id)

  useEffect(() => {
    if (conversation) {
      navigation.setOptions({ title: conversation.title })
    }
  }, [conversation, navigation])

  const resumeSession = useMutation({
    mutationFn: () =>
      api.post<{ sessionId: string }>('/api/sessions/resume', { conversationId: id }),
    onSuccess: (data) => {
      router.push(`/session/${data.sessionId}`)
    },
  })

  const handleShare = useCallback(async () => {
    if (!conversation) return
    const md = conversation.messages
      .map((m) => {
        const role = m.role === 'user' ? '**User**' : '**Assistant**'
        const text = m.content
          .filter((b) => b.type === 'text')
          .map((b) => (b as { text: string }).text)
          .join('\n')
        return `${role}\n\n${text}`
      })
      .join('\n\n---\n\n')
    await Share.share({ message: md })
  }, [conversation])

  const renderItem = useCallback(({ item }: { item: Message }) => (
    <MessageItem message={item} />
  ), [])

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {conversation ? (
        <>
          <FlashList
            data={conversation.messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            estimatedItemSize={100}
            contentContainerStyle={styles.listContent}
          />

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={handleShare}
            >
              <Text style={styles.shareBtnText}>Export</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.resumeBtn, resumeSession.isPending && styles.resumeBtnDisabled]}
              onPress={() => resumeSession.mutate()}
              disabled={resumeSession.isPending}
            >
              <Text style={styles.resumeBtnText}>
                {resumeSession.isPending ? 'Starting...' : '▶ Resume Session'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dark.bg.primary },
  listContent: { paddingVertical: spacing.md },
  toolContainer: { paddingHorizontal: spacing.md, gap: spacing.xs, marginVertical: spacing.xs },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: dark.border,
  },
  shareBtn: {
    backgroundColor: dark.bg.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: dark.border,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtnText: { color: dark.text.primary, fontSize: font.base },
  resumeBtn: {
    flex: 1,
    backgroundColor: dark.text.accent,
    borderRadius: 10,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resumeBtnDisabled: { opacity: 0.5 },
  resumeBtnText: { color: '#fff', fontWeight: '700', fontSize: font.base },
})
