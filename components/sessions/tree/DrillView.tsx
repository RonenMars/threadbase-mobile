import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, View, Text, TouchableOpacity, FlatList } from 'react-native'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { CaretLeft } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useProjectConversations } from '@/hooks/useProjectConversations'
import { useSessionNamesStore } from '@/stores/sessionNames'
import { useTreeDrillStore } from '@/stores/treeDrill'
import { useNavLockStore } from '@/stores/navLock'
import { useServersStore } from '@/stores/servers'
import { deriveSessionPresentation } from '@/lib/sessionPresentation'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useThemedStyles } from '@/hooks/useThemedStyles'
import { FAB_CLEARANCE } from '@/components/ui/FAB'
import { conversationRowTitle, sessionRowTitle } from '@/components/sessions/shared/rowTitle'
import { SectionEyebrow } from '@/components/sessions/now/SectionEyebrow'
import { DrillFolderRow } from './DrillFolderRow'
import { DrillRow } from './DrillRow'
import {
  subtreeActiveColor,
  subtreeHasLive,
  subtreeLatestActivityMs,
} from './treeUtils'
import { makeStyles } from './DrillView.styles'
import type { TreeNode, DrillItem } from './types'

interface Props {
  node: TreeNode
  serverId: string
  onBack: () => void
  /** Height of the floating chrome above; the back row starts below it. */
  topInset?: number
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
}

type DrillFlat =
  | { kind: 'eyebrow'; key: string; label: string }
  | { kind: 'folder'; key: string; node: TreeNode }
  | { kind: 'row'; key: string; item: DrillItem }

function parentCrumb(fullPath: string): string {
  const parts = fullPath.split('/').filter(Boolean)
  parts.pop()
  if (parts.length === 0) return '~'
  return `~/${parts[parts.length - 1]}`
}

export function DrillView({ node, serverId, onBack, topInset = 0, onScroll }: Props) {
  const { styles, theme } = useThemedStyles(makeStyles)
  const insets = useSafeAreaInsets()
  const { t } = useTranslation('sessions')
  const listContent = [styles.drillList, { paddingBottom: FAB_CLEARANCE + insets.bottom }]
  const router = useRouter()
  const getSessionName = useSessionNamesStore((s) => s.getName)
  const getNameOrigin = useSessionNamesStore((s) => s.getOrigin)
  const setCurrentDrill = useTreeDrillStore((s) => s.setCurrent)
  const serverLabel = useServersStore((s) => s.servers[serverId]?.label ?? serverId)
  const [stack, setStack] = useState<TreeNode[]>([node])
  const current = stack[stack.length - 1] ?? node

  // This is the expand-to-load boundary: the tree renders from summaries
  // alone, and a project's conversations are fetched only once the user opens
  // it here. A node with no summary of its own (a pure directory) has nothing
  // to fetch, so the query stays disabled.
  const projectPath = current.projectPath ?? ''
  const conversationsEnabled = current.conversationCount > 0 && projectPath.length > 0
  const {
    conversations,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: conversationsLoading,
  } = useProjectConversations(projectPath, serverId, undefined, {
    enabled: conversationsEnabled,
  })

  // Publish "current drill directory" while this view is mounted so the FAB
  // (rendered by app/index) can pre-fill the new-session flow with the same
  // path on the same server. Cleared on unmount so a back-out reverts to the
  // server default behaviour.
  useEffect(() => {
    setCurrentDrill({ serverId, path: current.fullPath })
    return () => {
      setCurrentDrill(null)
    }
  }, [serverId, current.fullPath, setCurrentDrill])

  const sessionItems: DrillItem[] = current.sessions.map((s) => ({
    key: `session:${s.serverId}::${s.id}`,
    label: sessionRowTitle(s, { name: getSessionName(s.serverId, s.id), origin: getNameOrigin(s.serverId, s.id) }),
    timestamp: s.completedAt ?? s.startedAt,
    messageCount: s.promptCount,
    lastOutput: s.lastOutput ?? null,
    branch: s.branch ?? null,
    tier: deriveSessionPresentation(s).tier,
    serverId: s.serverId,
    serverLabel: s.serverLabel,
    onPress: () => {
      useNavLockStore.getState().lock()
      router.push(`/session/${s.id}?server=${s.serverId}`)
    },
  }))

  const conversationItems: DrillItem[] = conversationsEnabled
    ? conversations.map((c) => ({
        key: `conversation:${c.serverId}::${c.id}`,
        label: conversationRowTitle(c, { name: getSessionName(c.serverId, c.id), origin: getNameOrigin(c.serverId, c.id) }),
        timestamp: c.lastMessage?.timestamp ?? c.lastActivity,
        messageCount: c.messageCount,
        firstMessage: c.firstMessage ?? null,
        lastMessage: c.lastMessage ?? null,
        branch: c.branch ?? null,
        serverId: c.serverId,
        serverLabel: c.serverLabel,
        provider: c.provider,
        onPress: () => {
          useNavLockStore.getState().lock()
          router.push(`/conversation/${c.id}?server=${c.serverId}`)
        },
      }))
    : []

  const folders = useMemo(
    () => Array.from(current.children.values()).sort((a, b) => subtreeLatestActivityMs(b) - subtreeLatestActivityMs(a)),
    [current],
  )
  const hereCount = current.sessions.length + current.conversationCount
  const hereItems = [...sessionItems, ...conversationItems]

  const flatData: DrillFlat[] = []
  if (folders.length > 0) {
    flatData.push({ kind: 'eyebrow', key: 'folders', label: t('tree.folders') })
    for (const child of folders) {
      flatData.push({ kind: 'folder', key: `folder:${child.fullPath}`, node: child })
    }
  }
  if (hereCount > 0 || hereItems.length > 0 || (conversationsEnabled && conversationsLoading)) {
    flatData.push({ kind: 'eyebrow', key: 'here', label: t('tree.here', { count: hereCount }) })
    for (const item of hereItems) {
      flatData.push({ kind: 'row', key: item.key, item })
    }
  }

  const handleBack = () => {
    if (stack.length > 1) {
      setStack((prev) => prev.slice(0, -1))
      return
    }
    onBack()
  }

  const backRow = (
    <TouchableOpacity style={styles.backRow} onPress={handleBack} accessibilityRole="button">
      <CaretLeft size={18} color={theme.text.accent} weight="bold" />
      <View style={styles.backBody}>
        <Text style={styles.backCrumb} numberOfLines={1}>
          {serverLabel} · {parentCrumb(current.fullPath)}
        </Text>
        <Text style={styles.backLabel} numberOfLines={1}>{current.name}</Text>
      </View>
    </TouchableOpacity>
  )

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }

  // Sessions are already in hand (they stay eager), so the spinner belongs to
  // the conversation half only — first page loading, or a page appending.
  const listFooter =
    conversationsLoading || isFetchingNextPage ? (
      <ActivityIndicator
        style={styles.footerSpinner}
        size="small"
        color={theme.text.secondary}
        testID="drill-conversations-loading"
      />
    ) : null

  return (
    <View style={[styles.drill, { paddingTop: topInset }]} testID={`drill-cwd-${current.fullPath}`}>
      {backRow}
      <FlatList
        data={flatData}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => {
          if (item.kind === 'eyebrow') {
            return <SectionEyebrow label={item.label} tone="muted" />
          }
          if (item.kind === 'folder') {
            return (
              <DrillFolderRow
                name={item.node.name}
                count={item.node.totalCount}
                timestampMs={subtreeLatestActivityMs(item.node)}
                dotColor={subtreeActiveColor(item.node)}
                live={subtreeHasLive(item.node)}
                onPress={() => setStack((prev) => [...prev, item.node])}
              />
            )
          }
          return <DrillRow item={item.item} />
        }}
        contentContainerStyle={listContent}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        onScroll={onScroll}
        scrollEventThrottle={16}
        extraData={current.fullPath}
        ListFooterComponent={listFooter}
      />
    </View>
  )
}
