import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Share,
  ActivityIndicator,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  type ListRenderItemInfo,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { MessageSkeletonRow } from '@/components/conversation/MessageSkeletonRow'
import { MessageBubble } from '@/components/conversation/MessageBubble'
import { ToolCard } from '@/components/conversation/ToolCard'
import { DiffViewer } from '@/components/conversation/DiffViewer'
import { useConversation } from '@/hooks/useConversations'
import { createApiForServer } from '@/services/api-client'
import { useServersStore } from '@/stores/servers'
import { dark, font, spacing } from '@/constants/theme'
import { InfoModal } from '@/components/shared/InfoModal'
import type { Message, MessageContent } from '@/types/api'

const MESSAGE_SKELETON_KEYS = Array.from({ length: 10 }, (_, i) => `msg-sk-${i}`)


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
            if (!block.text.trim()) return null
            return <MessageBubble key={i} message={{ ...message, content: [block] }} />
          }
          return renderContent(block, i)
        })}
      </View>
    )
  }

  if (message.content.length === 0) return null
  return <MessageBubble message={message} />
}

export default function ConversationDetailScreen() {
  const { id, server } = useLocalSearchParams<{ id: string; server?: string }>()
  const navigation = useNavigation()
  const router = useRouter()

  // Fall back to first server if no server param provided
  const fallbackServerId = useServersStore((s) => s.activeServerIds[0] ?? '')
  const serverId = server || fallbackServerId

  const {
    data: conversation,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    totalMessages,
    loadedMessages,
  } = useConversation(serverId, id)
  const listRef = useRef<FlatList<Message>>(null)
  const hasInitialScrolled = useRef(false)
  const hasStartedAutoScroll = useRef(false)
  const prevScrollY = useRef(0)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const [infoVisible, setInfoVisible] = useState(false)

  useEffect(() => {
    hasInitialScrolled.current = false
    hasStartedAutoScroll.current = false
  }, [id])

  useEffect(() => {
    if (!conversation || hasStartedAutoScroll.current) return
    hasStartedAutoScroll.current = true
    const t = setTimeout(() => { hasInitialScrolled.current = true }, 600)
    return () => clearTimeout(t)
  }, [conversation])

  useEffect(() => {
    if (conversation) {
      navigation.setOptions({
        title: conversation.title,
        headerRight: () => (
          <TouchableOpacity
            onPress={() => setInfoVisible(true)}
            hitSlop={8}
            accessibilityLabel="Conversation info"
            style={{ paddingHorizontal: spacing.xs }}
          >
            <Ionicons name="information-circle-outline" size={22} color={dark.text.secondary} />
          </TouchableOpacity>
        ),
      })
    }
  }, [conversation, navigation])

  // Auto-fetch all older message pages upfront
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const handleContentSizeChange = useCallback(() => {
    if (hasInitialScrolled.current) return
    listRef.current?.scrollToEnd({ animated: false })
  }, [])

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
    const y = contentOffset.y
    const scrollingUp = y < prevScrollY.current
    prevScrollY.current = y
    setShowScrollTop(scrollingUp && y > 100)
    const distFromBottom = contentSize.height - y - layoutMeasurement.height
    setShowScrollBottom(distFromBottom > 100)

    // Load older messages when scrolled near the top
    if (y < 200 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }, [id, hasNextPage, isFetchingNextPage, fetchNextPage])

  const resumeSession = useMutation({
    mutationFn: () => {
      const api = createApiForServer(serverId)
      return api.post<{ id: string }>('/api/sessions/resume', { conversationId: id })
    },
    onSuccess: (data) => {
      router.push(`/session/${data.id}?server=${serverId}`)
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

  const renderSkeletonItem = useCallback(({ index }: ListRenderItemInfo<string>) => (
    <MessageSkeletonRow index={index} />
  ), [])

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.listWrapper}>
          <FlatList
            data={MESSAGE_SKELETON_KEYS}
            keyExtractor={(k) => k}
            renderItem={renderSkeletonItem}
            contentContainerStyle={styles.listContent}
          />
        </View>
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Couldn't load conversation</Text>
          <Text style={styles.errorMessage}>{error.message}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  if (!conversation) return null

  const hasMessages = conversation.messages.length > 0
  const isLoadingMessages = Boolean(hasNextPage || isFetchingNextPage)

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {isLoadingMessages && totalMessages > 0 ? (
        <ProgressBar
          loaded={loadedMessages}
          total={totalMessages}
          label="messages"
        />
      ) : null}
      {hasMessages ? (
        <View style={styles.listWrapper}>
          <FlatList
            ref={listRef}
            data={conversation.messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={handleContentSizeChange}
            onScroll={handleScroll}
            scrollEventThrottle={100}
            ListHeaderComponent={
              isFetchingNextPage ? (
                <View style={styles.headerLoading}>
                  <ActivityIndicator color={dark.text.secondary} />
                </View>
              ) : null
            }
          />
          {showScrollTop ? (
            <TouchableOpacity
              style={[styles.scrollBtn, styles.scrollBtnTop]}
              onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
              accessibilityLabel="Scroll to top"
            >
              <Text style={styles.scrollBtnText}>↑ Top</Text>
            </TouchableOpacity>
          ) : null}
          {showScrollBottom ? (
            <TouchableOpacity
              style={[styles.scrollBtn, styles.scrollBtnBottom]}
              onPress={() => listRef.current?.scrollToEnd({ animated: true })}
              accessibilityLabel="Scroll to bottom"
            >
              <Text style={styles.scrollBtnText}>↓ Bottom</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No messages in this conversation.</Text>
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Text style={styles.shareBtnText}>Export</Text>
        </TouchableOpacity>
        <View style={styles.resumeWrapper}>
          {resumeSession.isError ? (
            <Text style={styles.resumeError} numberOfLines={2}>
              {resumeSession.error instanceof Error
                ? resumeSession.error.message
                : 'Failed to resume'}
            </Text>
          ) : null}
          <TouchableOpacity
            style={[
              styles.resumeBtn,
              resumeSession.isPending && styles.resumeBtnDisabled,
            ]}
            onPress={() => resumeSession.mutate()}
            disabled={resumeSession.isPending}
          >
            <Text style={styles.resumeBtnText}>
              {resumeSession.isPending ? 'Starting...' : '▶ Resume Session'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <InfoModal
        visible={infoVisible}
        onClose={() => setInfoVisible(false)}
        title="Conversation Info"
        fields={[
          { label: 'ID', value: conversation.id },
          { label: 'Title', value: conversation.title },
          { label: 'Session Name', value: conversation.sessionName },
          { label: 'Project Path', value: conversation.projectPath },
          { label: 'File Path', value: conversation.filePath },
          { label: 'Branch', value: conversation.branch },
          { label: 'Account', value: conversation.account },
          { label: 'Model', value: conversation.model },
          { label: 'Message Count', value: String(conversation.messageCount) },
          { label: 'Total Tokens', value: conversation.totalTokens != null ? String(conversation.totalTokens) : undefined },
          { label: 'Last Activity', value: conversation.lastActivity },
        ]}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dark.bg.primary },
  listWrapper: { flex: 1 },
  listContent: { paddingVertical: spacing.md },
  headerLoading: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBtn: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: dark.text.accent,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  scrollBtnTop: { top: spacing.md },
  scrollBtnBottom: { bottom: spacing.md },
  scrollBtnText: { color: '#fff', fontSize: font.sm, fontWeight: '600' },
  toolContainer: { paddingHorizontal: spacing.md, gap: spacing.xs, marginVertical: spacing.xs },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: dark.border,
  },
  resumeWrapper: {
    flex: 1,
    gap: spacing.xs,
  },
  resumeError: {
    color: '#ef4444',
    fontSize: font.xs,
    textAlign: 'center',
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
    backgroundColor: dark.text.accent,
    borderRadius: 10,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resumeBtnDisabled: { opacity: 0.5 },
  resumeBtnText: { color: '#fff', fontWeight: '700', fontSize: font.base },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  errorTitle: { color: dark.text.primary, fontSize: font.base, fontWeight: '600' },
  errorMessage: { color: dark.text.secondary, fontSize: font.sm, textAlign: 'center' },
  emptyText: { color: dark.text.secondary, fontSize: font.sm },
  retryBtn: {
    marginTop: spacing.md,
    backgroundColor: dark.bg.card,
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryBtnText: { color: dark.text.primary, fontSize: font.base },
})
