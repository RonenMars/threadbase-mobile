import React, { useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { SkeletonBox } from '@/components/ui/Skeleton'
import { dark, font, radius, spacing } from '@/constants/theme'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import { ConversationListItem } from '@/components/sessions/shared/ConversationListItem'
import type { MultiConversation } from '@/types/api'

const CONV_SKELETON_KEYS = Array.from({ length: 12 }, (_, i) => `conv-sk-${i}`)

function ConversationRowSkeleton() {
  return (
    <View style={styles.skeletonRow}>
      <SkeletonBox height={16} width="70%" borderRadius={radius.sm} />
      <SkeletonBox height={12} width="92%" borderRadius={radius.sm} style={styles.skLine} />
      <SkeletonBox height={10} width={120} borderRadius={radius.sm} style={styles.skLine} />
    </View>
  )
}

interface RowProps {
  conversation: MultiConversation
  activeServerCount: number
  siblings: readonly string[]
  highlight?: string
}

const ConversationRow = React.memo(function ConversationRow({
  conversation: c,
  activeServerCount,
  siblings,
  highlight,
}: RowProps) {
  const router = useRouter()
  const legacyPreview = useSettingsStore((s) => s.historyMessageDisplay)
  const density = useSettingsStore((s) => s.rowDensity)
  const pathMode = useSettingsStore((s) => s.rowPathDisplay)
  const serverIndicator = useSettingsStore((s) => s.rowServerIndicator)
  const chipVariant = useSettingsStore((s) => s.rowServerChipVariant)
  const serverColor = useServersStore((s) => (c.serverId ? s.servers[c.serverId]?.color : undefined))

  return (
    <ConversationListItem
      title={c.title}
      path={c.projectPath}
      siblings={siblings}
      timestamp={c.lastMessage?.timestamp ?? c.lastActivity}
      messageCount={c.messageCount}
      branch={c.branch}
      firstMessage={c.firstMessage}
      lastMessage={c.lastMessage}
      preview={c.preview}
      serverLabel={c.serverLabel}
      serverColor={serverColor}
      activeServerCount={activeServerCount}
      previewMode={legacyPreview === 'last' ? 'last' : 'first'}
      density={density}
      pathDisplayMode={pathMode}
      showServer={serverIndicator}
      serverChipVariant={chipVariant}
      highlight={highlight}
      onPress={() => router.push(`/conversation/${c.id}?server=${c.serverId}`)}
    />
  )
})

interface Props {
  conversations: MultiConversation[]
  onRefresh: () => void
  refreshing: boolean
  onEndReached: () => void
  searchQuery: string
  onSearchChange: (q: string) => void
  searchOpen?: boolean
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
  searchOpen = true,
  isLoadingInitial = false,
  isFetchingNextPage = false,
  headerRight,
  loadingProgress = null,
}: Props) {
  const { t } = useTranslation(['conversation', 'common'])
  const activeServerCount = useServersStore((s) => s.activeServerIds.length)
  const skeletonMode = isLoadingInitial
  const listData: (MultiConversation | string)[] = skeletonMode ? [...CONV_SKELETON_KEYS] : conversations
  const siblings = useMemo(
    () => conversations.map((c) => c.projectPath).filter(Boolean),
    [conversations],
  )
  const listRef = useRef<FlatList>(null)
  const prevScrollY = useRef(0)
  const showTopVal = useSharedValue(0)
  const showBottomVal = useSharedValue(0)

  const topBtnStyle = useAnimatedStyle(() => ({
    opacity: withTiming(showTopVal.value, { duration: 220 }),
    pointerEvents: showTopVal.value > 0 ? 'auto' : 'none',
  }))
  const bottomBtnStyle = useAnimatedStyle(() => ({
    opacity: withTiming(showBottomVal.value, { duration: 220 }),
    pointerEvents: showBottomVal.value > 0 ? 'auto' : 'none',
  }))

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
    const y = contentOffset.y
    const scrollingUp = y < prevScrollY.current
    prevScrollY.current = y
    const distanceFromBottom = contentSize.height - y - layoutMeasurement.height
    showTopVal.value = !scrollingUp && y > 120 ? 1 : 0
    showBottomVal.value = scrollingUp && distanceFromBottom > 120 ? 1 : 0
  }, [showTopVal, showBottomVal])

  const keyExtractor = useCallback(
    (item: MultiConversation | string) =>
      typeof item === 'string' ? item : `conversation:${item.serverId}::${item.id}`,
    [],
  )

  const renderItem = useCallback(
    ({ item }: { item: MultiConversation | string }) =>
      typeof item === 'string' ? (
        <ConversationRowSkeleton />
      ) : (
        <ConversationRow
          conversation={item}
          activeServerCount={activeServerCount}
          siblings={siblings}
          highlight={searchQuery}
        />
      ),
    [activeServerCount, siblings, searchQuery],
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
      {searchOpen ? (
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder="Search conversations…"
            placeholderTextColor={dark.text.secondary}
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {headerRight}
        </View>
      ) : null}

      {loadingProgress ? (
        <ProgressBar
          loaded={loadingProgress.loaded}
          total={loadingProgress.total}
          label="conversations"
          isCounting={loadingProgress.isCounting}
        />
      ) : null}

      <FlatList
        ref={listRef}
        data={listData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        onEndReached={skeletonMode ? undefined : onEndReached}
        onEndReachedThreshold={0.35}
        refreshControl={refreshControl}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        ItemSeparatorComponent={Separator}
        ListFooterComponent={
          isFetchingNextPage && !skeletonMode ? (
            <View style={styles.listFooter}>
              <ActivityIndicator color={dark.text.secondary} />
              <Text style={styles.listFooterText}>{t('list.loadingMore')}</Text>
            </View>
          ) : null
        }
      />

      <Animated.View style={[styles.scrollBtn, styles.scrollBtnTop, topBtnStyle]} pointerEvents="box-none">
        <TouchableOpacity
          onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
          accessibilityLabel="Scroll to top"
          style={styles.scrollBtnInner}
        >
          <Text style={styles.scrollBtnText}>{t('common:nav.top')}</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[styles.scrollBtn, styles.scrollBtnBottom, bottomBtnStyle]} pointerEvents="box-none">
        <TouchableOpacity
          onPress={() => listRef.current?.scrollToEnd({ animated: true })}
          accessibilityLabel="Scroll to bottom"
          style={styles.scrollBtnInner}
        >
          <Text style={styles.scrollBtnText}>{t('common:nav.bottom')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skLine: { marginTop: spacing.xs },
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

  searchInput: {
    flex: 1,
    color: dark.text.primary,
    fontSize: font.base,
    paddingVertical: spacing.sm,
  },
  skeletonRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 64,
    gap: spacing.xs,
  },
  separator: {
    height: 1,
    backgroundColor: dark.border,
    marginHorizontal: spacing.md,
  },
  scrollBtn: {
    position: 'absolute',
    alignSelf: 'center',
  },
  scrollBtnTop: {
    top: spacing.md,
  },
  scrollBtnBottom: {
    bottom: spacing.md,
  },
  scrollBtnInner: {
    backgroundColor: 'rgba(31, 111, 235, 0.14)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(88, 166, 255, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  scrollBtnText: {
    color: 'rgba(230, 237, 243, 0.6)',
    fontSize: 12,
    fontWeight: '500',
  },
})
