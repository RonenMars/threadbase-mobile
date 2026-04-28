import React, { useCallback, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  FlatList,
} from 'react-native'
import { useRouter } from 'expo-router'
import { ServerBadge } from '@/components/servers/ServerBadge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { SkeletonBox } from '@/components/ui/Skeleton'
import { dark, font, radius, spacing } from '@/constants/theme'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import type { MultiConversation } from '@/types/api'

const CONV_SKELETON_KEYS = Array.from({ length: 12 }, (_, i) => `conv-sk-${i}`)
const MAX_PREVIEW_LENGTH = 80

function ConversationRowSkeleton() {
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <SkeletonBox height={16} width="70%" borderRadius={radius.sm} />
        <SkeletonBox height={12} width="45%" borderRadius={radius.sm} style={styles.skLine} />
        <SkeletonBox height={12} width="92%" borderRadius={radius.sm} style={styles.skLine} />
        <View style={[styles.meta, styles.skMeta]}>
          <SkeletonBox height={10} width={64} borderRadius={radius.sm} />
          <SkeletonBox height={10} width={52} borderRadius={radius.sm} />
        </View>
      </View>
      <View style={styles.rowRight}>
        <SkeletonBox height={11} width={44} borderRadius={radius.sm} />
        <SkeletonBox height={11} width={40} borderRadius={radius.sm} />
      </View>
    </View>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatMessageTime(iso: string): string {
  const d = new Date(iso)
  const mon = SHORT_MONTHS[d.getMonth()]
  const day = d.getDate()
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${mon} ${day}, ${h}:${m}`
}

interface RowProps {
  conversation: MultiConversation
  showServerBadge: boolean
}

const ConversationRow = React.memo(function ConversationRow({ conversation: c, showServerBadge }: RowProps) {
  const router = useRouter()
  const displayPref = useSettingsStore((s) => s.historyMessageDisplay)
  const msg = displayPref === 'last' ? c.lastMessage ?? c.firstMessage : c.firstMessage ?? c.lastMessage
  const previewText = (msg?.text ?? c.preview)?.replace(/\s+/g, ' ').trim()
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/conversation/${c.id}?server=${c.serverId}`)}
      accessibilityLabel={`Conversation: ${c.title}`}
      accessibilityRole="button"
    >
      <View style={styles.rowMain}>
        <Text style={styles.title} numberOfLines={1}>{c.title}</Text>
        {c.sessionName ? (
          <Text style={styles.sessionName} numberOfLines={1}>{c.sessionName}</Text>
        ) : null}
        {previewText ? (
          <Text style={styles.messagePreview} numberOfLines={1}>
            {msg?.timestamp ? `${formatMessageTime(msg.timestamp)} · ` : ''}
            {previewText.length > MAX_PREVIEW_LENGTH
              ? `${previewText.slice(0, MAX_PREVIEW_LENGTH)}...`
              : previewText}
          </Text>
        ) : null}
        <View style={styles.meta}>
          <Text style={styles.metaText}>{c.projectPath.split('/').pop()}</Text>
          {c.branch ? (
            <View style={styles.branchBadge}>
              <Text style={styles.branchText}>{c.branch}</Text>
            </View>
          ) : null}
          {showServerBadge ? (
            <ServerBadge serverId={c.serverId} label={c.serverLabel} />
          ) : null}
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.date}>{formatDate(c.lastActivity)}</Text>
        <Text style={styles.metaText}>{c.messageCount} msgs</Text>
        {c.totalTokens ? (
          <Text style={styles.metaText}>{(c.totalTokens / 1000).toFixed(1)}k tokens</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  )
})

interface Props {
  conversations: MultiConversation[]
  onRefresh: () => void
  refreshing: boolean
  onEndReached: () => void
  searchQuery: string
  onSearchChange: (q: string) => void
  /** First page still loading — show skeleton rows. */
  isLoadingInitial?: boolean
  isFetchingNextPage?: boolean
  headerRight?: React.ReactNode
  loadingProgress?: { loaded: number; total: number; isCounting: boolean } | null
}

function Separator() {
  return <View style={styles.separator} />
}

export function ConversationList({
  conversations,
  onRefresh,
  refreshing,
  onEndReached,
  searchQuery,
  onSearchChange,
  isLoadingInitial = false,
  isFetchingNextPage = false,
  headerRight,
  loadingProgress = null,
}: Props) {
  const multipleServers = useServersStore((s) => s.activeServerIds.length > 1)
  const skeletonMode = isLoadingInitial
  const listData: (MultiConversation | string)[] = skeletonMode ? [...CONV_SKELETON_KEYS] : conversations

  const keyExtractor = useCallback(
    (item: MultiConversation | string) =>
      typeof item === 'string' ? item : `${item.serverId}::${item.id}`,
    [],
  )

  const renderItem = useCallback(
    ({ item }: { item: MultiConversation | string }) =>
      typeof item === 'string' ? (
        <ConversationRowSkeleton />
      ) : (
        <ConversationRow conversation={item} showServerBadge={multipleServers} />
      ),
    [multipleServers],
  )

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        tintColor={dark.text.secondary}
      />
    ),
    [refreshing, onRefresh],
  )

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder="Search conversations..."
          placeholderTextColor={dark.text.secondary}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {headerRight}
      </View>

      {loadingProgress ? (
        <ProgressBar
          loaded={loadingProgress.loaded}
          total={loadingProgress.total}
          label="conversations"
          isCounting={loadingProgress.isCounting}
        />
      ) : null}

      <FlatList
        data={loadingProgress ? [] : listData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        onEndReached={skeletonMode ? undefined : onEndReached}
        onEndReachedThreshold={0.35}
        refreshControl={refreshControl}
        ItemSeparatorComponent={Separator}
        ListFooterComponent={
          isFetchingNextPage && !skeletonMode ? (
            <View style={styles.listFooter}>
              <ActivityIndicator color={dark.text.secondary} />
              <Text style={styles.listFooterText}>Loading more…</Text>
            </View>
          ) : null
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skLine: { marginTop: spacing.xs },
  skMeta: { marginTop: spacing.xs },
  listFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  listFooterText: {
    color: dark.text.secondary,
    fontSize: font.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: dark.border,
    minHeight: 44,
  },
  searchIcon: { fontSize: font.sm, marginRight: spacing.sm },
  searchInput: {
    flex: 1,
    color: dark.text.primary,
    fontSize: font.base,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 44,
    gap: spacing.md,
  },
  rowMain: { flex: 1, gap: spacing.xs },
  title: {
    color: dark.text.primary,
    fontSize: font.base,
    fontWeight: '500',
  },
  sessionName: {
    color: dark.text.secondary,
    fontSize: font.xs,
  },
  messagePreview: {
    color: dark.text.secondary,
    fontSize: font.xs,
    fontStyle: 'italic',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    overflow: 'hidden',
  },
  metaText: {
    color: dark.text.secondary,
    fontSize: font.xs,
  },
  branchBadge: {
    backgroundColor: dark.bg.card,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: dark.border,
  },
  branchText: {
    color: dark.text.secondary,
    fontSize: 10,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  date: {
    color: dark.text.secondary,
    fontSize: font.xs,
  },
  separator: {
    height: 1,
    backgroundColor: dark.border,
    marginHorizontal: spacing.md,
  },
})
