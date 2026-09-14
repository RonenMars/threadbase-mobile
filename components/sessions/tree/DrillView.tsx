import React, { useEffect } from 'react'
import { ActivityIndicator, View, Text, TouchableOpacity, FlatList } from 'react-native'
import { CaretLeft } from 'phosphor-react-native'
import { useRouter } from 'expo-router'
import { useProjectConversations } from '@/hooks/useProjectConversations'
import { useSessionNamesStore } from '@/stores/sessionNames'
import { useTreeDrillStore } from '@/stores/treeDrill'
import { useNavLockStore } from '@/stores/navLock'
import { deriveSessionPresentation } from '@/lib/sessionPresentation'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useThemedStyles } from '@/hooks/useThemedStyles'
import { FAB_CLEARANCE } from '@/components/ui/FAB'
import { conversationRowTitle, sessionRowTitle } from '@/components/sessions/shared/rowTitle'
import { DrillRow } from './DrillRow'
import { makeStyles } from './DrillView.styles'
import type { TreeNode, DrillItem } from './types'

interface Props {
  node: TreeNode
  serverId: string
  onBack: () => void
  /** Height of the floating chrome above; the back row starts below it. */
  topInset?: number
}

export function DrillView({ node, serverId, onBack, topInset = 0 }: Props) {
  const { styles, theme } = useThemedStyles(makeStyles)
  const insets = useSafeAreaInsets()
  const listContent = [styles.drillList, { paddingBottom: FAB_CLEARANCE + insets.bottom }]
  const router = useRouter()
  const getSessionName = useSessionNamesStore((s) => s.getName)
  const getNameOrigin = useSessionNamesStore((s) => s.getOrigin)
  const setCurrentDrill = useTreeDrillStore((s) => s.setCurrent)

  // This is the expand-to-load boundary: the tree renders from summaries
  // alone, and a project's conversations are fetched only once the user opens
  // it here. A node with no summary of its own (a pure directory) has nothing
  // to fetch, so the query stays disabled.
  const projectPath = node.projectPath ?? ''
  const {
    conversations,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: conversationsLoading,
  } = useProjectConversations(projectPath, serverId, undefined, {
    enabled: node.conversationCount > 0 && projectPath.length > 0,
  })

  // Publish "current drill directory" while this view is mounted so the FAB
  // (rendered by app/index) can pre-fill the new-session flow with the same
  // path on the same server. Cleared on unmount so a back-out reverts to the
  // server default behaviour.
  useEffect(() => {
    setCurrentDrill({ serverId, path: node.fullPath })
    return () => {
      setCurrentDrill(null)
    }
  }, [serverId, node.fullPath, setCurrentDrill])

  const sessionItems: DrillItem[] = node.sessions.map((s) => ({
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

  const conversationItems: DrillItem[] = conversations.map((c) => ({
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

  const backRow = (
    <TouchableOpacity style={styles.backRow} onPress={onBack}>
      <CaretLeft size={18} color={theme.text.accent} weight="bold" />
      <Text style={styles.backLabel} numberOfLines={1}>{node.name}</Text>
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

  const allItems = [...sessionItems, ...conversationItems]
  return (
    <View style={[styles.drill, { paddingTop: topInset }]} testID={`drill-cwd-${node.fullPath}`}>
      {backRow}
      <FlatList
        data={allItems}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => <DrillRow item={item} />}
        contentContainerStyle={listContent}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={listFooter}
      />
    </View>
  )
}
