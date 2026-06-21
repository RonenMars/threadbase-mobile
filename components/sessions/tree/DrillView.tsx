import React, { useEffect } from 'react'
import { View, Text, TouchableOpacity, FlatList, SectionList } from 'react-native'
import { useRouter } from 'expo-router'
import { useSettingsStore } from '@/stores/settings'
import { useSessionNamesStore } from '@/stores/sessionNames'
import { useTreeDrillStore } from '@/stores/treeDrill'
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
    onPress: () => router.push(`/session/${s.id}?server=${s.serverId}`),
  }))

  const conversationItems: DrillItem[] = node.conversations.map((c) => ({
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
    onPress: () => router.push(`/conversation/${c.id}?server=${c.serverId}`),
  }))

  const backRow = (
    <TouchableOpacity style={styles.backRow} onPress={onBack}>
      <Text style={styles.backChevron}>‹</Text>
      <Text style={styles.backLabel} numberOfLines={1}>{node.name}</Text>
    </TouchableOpacity>
  )

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
        />
      </View>
    )
  }

  const sections = [
    ...(sessionItems.length > 0 ? [{ title: 'Sessions', data: sessionItems }] : []),
    ...(conversationItems.length > 0 ? [{ title: 'History', data: conversationItems }] : []),
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
      />
    </View>
  )
}
