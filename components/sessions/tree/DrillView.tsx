import React from 'react'
import { View, Text, TouchableOpacity, FlatList, SectionList } from 'react-native'
import { useRouter } from 'expo-router'
import { useSettingsStore } from '@/stores/settings'
import { useSessionNamesStore } from '@/stores/sessionNames'
import { latestActivityLabel } from './treeUtils'
import { DrillRow } from './DrillRow'
import { styles } from './DrillView.styles'
import type { TreeNode, DrillItem } from './types'

interface Props {
  node: TreeNode
  onBack: () => void
}

export function DrillView({ node, onBack }: Props) {
  const router = useRouter()
  const mergeChats = useSettingsStore((s) => s.mergeChats)
  const getSessionName = useSessionNamesStore((s) => s.getName)

  const sessionItems: DrillItem[] = node.sessions.map((s) => ({
    key: `s-${s.id}`,
    label: getSessionName(s.serverId, s.id) ?? s.projectName ?? s.projectPath,
    time: latestActivityLabel(node),
    status: s.status,
    onPress: () => router.push(`/session/${s.id}?server=${s.serverId}`),
  }))

  const conversationItems: DrillItem[] = node.conversations.map((c) => ({
    key: `c-${c.id}`,
    label: c.title || c.projectPath,
    time: latestActivityLabel(node),
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
      <View style={styles.drill}>
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
    <View style={styles.drill}>
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
