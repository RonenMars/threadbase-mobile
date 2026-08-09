import React, { useEffect } from 'react'
import { ActivityIndicator, View, Text, TouchableOpacity, FlatList, SectionList } from 'react-native'
import { useRouter } from 'expo-router'
import { useProjectConversations } from '@/hooks/useProjectConversations'
import { useSettingsStore } from '@/stores/settings'
import { useSessionNamesStore } from '@/stores/sessionNames'
import { useTreeDrillStore } from '@/stores/treeDrill'
import { useNavLockStore } from '@/stores/navLock'
import { useTheme } from '@/contexts/ThemeContext'
import { DrillRow } from './DrillRow'
import { makeStyles } from './DrillView.styles'
import type { TreeNode, DrillItem } from './types'

interface Props {
  node: TreeNode
  serverId: string
  onBack: () => void
}

export function DrillView({ node, serverId, onBack }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const router = useRouter()
  const mergeChats = useSettingsStore((s) => s.mergeChats)
  const getSessionName = useSessionNamesStore((s) => s.getName)
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
    label: getSessionName(s.serverId, s.id) ?? s.projectName ?? s.projectPath,
    timestamp: s.completedAt ?? s.startedAt,
    messageCount: s.promptCount,
    lastOutput: s.lastOutput ?? null,
    branch: s.branch ?? null,
    status: s.status,
    serverId: s.serverId,
    serverLabel: s.serverLabel,
    onPress: () => {
      useNavLockStore.getState().lock()
      router.push(`/session/${s.id}?server=${s.serverId}`)
    },
  }))

  const conversationItems: DrillItem[] = conversations.map((c) => ({
    key: `conversation:${c.serverId}::${c.id}`,
    label: c.title || c.projectPath,
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
      <Text style={styles.backChevron}>‹</Text>
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

  if (mergeChats) {
    const allItems = [...sessionItems, ...conversationItems]
    return (
      <View style={styles.drill} testID={`drill-cwd-${node.fullPath}`}>
        {backRow}
        <FlatList
          data={allItems}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => <DrillRow item={item} />}
          contentContainerStyle={styles.drillList}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={listFooter}
        />
      </View>
    )
  }

  // The History header appears as soon as the node is known to have
  // conversations, so the section doesn't pop in after the fetch resolves.
  const showHistorySection = conversationItems.length > 0 || node.conversationCount > 0
  const sections = [
    ...(sessionItems.length > 0 ? [{ title: 'Sessions', data: sessionItems }] : []),
    ...(showHistorySection ? [{ title: 'History', data: conversationItems }] : []),
  ]

  return (
    <View style={styles.drill} testID={`drill-cwd-${node.fullPath}`}>
      {backRow}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => <DrillRow item={item} />}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        contentContainerStyle={styles.drillList}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={listFooter}
      />
    </View>
  )
}
