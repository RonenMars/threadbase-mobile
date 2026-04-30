import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { Text, View, TextInput, FlatList, SectionList, TouchableOpacity, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { useDebounce } from 'use-debounce'
import { buildTree, compactTree, flattenVisible } from './treeUtils'
import { TreeRow } from './TreeRow'
import { DrillView } from './DrillView'
import { ServerRootRow } from './ServerRootRow'
import { EmptyState } from '../../ui/EmptyState'
import { styles } from './TreeSessionsList.styles'
import { searchStyles } from '../SearchStyles'
import type { FlatItem, ServerTree, TreeNode, TreeSessionsListProps } from './types'
import type { MultiSession, MultiConversation } from '@/types/api'

export function TreeSessionsList({ sessions, conversations, refreshing, onRefresh, searchOpen }: TreeSessionsListProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery] = useDebounce(searchQuery, 300)
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    if (!searchOpen) setSearchQuery('')
  }, [searchOpen])

  const searchSections = useMemo(() => {
    if (!debouncedQuery) return []
    const q = debouncedQuery.toLowerCase()
    const matchedConversations = conversations.filter(
      (c) =>
        c.title?.toLowerCase().includes(q) ||
        c.preview?.toLowerCase().includes(q) ||
        c.firstMessage?.text?.toLowerCase().includes(q) ||
        c.lastMessage?.text?.toLowerCase().includes(q),
    )
    const matchedSessions = sessions.filter(
      (s) => s.projectName?.toLowerCase().includes(q) || s.lastOutput?.toLowerCase().includes(q),
    )
    const result: { title: string; data: (MultiConversation | MultiSession)[]; kind: 'conversation' | 'session' }[] = []
    if (matchedConversations.length > 0) {
      result.push({
        title: `Conversations · ${matchedConversations.length} result${matchedConversations.length === 1 ? '' : 's'}`,
        data: matchedConversations,
        kind: 'conversation',
      })
    }
    if (matchedSessions.length > 0) {
      result.push({
        title: `Sessions · ${matchedSessions.length} result${matchedSessions.length === 1 ? '' : 's'}`,
        data: matchedSessions,
        kind: 'session',
      })
    }
    return result
  }, [debouncedQuery, conversations, sessions])

  const renderSearchItem = useCallback(
    ({ item }: { item: MultiConversation | MultiSession }) => {
      const lastSegment = item.projectPath?.split('/').filter(Boolean).pop() ?? ''
      const isSession = 'status' in item
      const title = isSession ? (item as MultiSession).projectName : (item as MultiConversation).title
      const onPress = isSession
        ? () => {
            const s = item as MultiSession
            if (s.source === 'discovered' && s.conversationId) {
              router.push(`/conversation/${s.conversationId}?server=${s.serverId}`)
            } else {
              router.push(`/session/${s.id}?server=${s.serverId}`)
            }
          }
        : () => {
            const c = item as MultiConversation
            router.push(`/conversation/${c.id}?server=${c.serverId}`)
          }
      return (
        <TouchableOpacity style={searchStyles.resultRow} onPress={onPress} activeOpacity={0.7}>
          <Text style={searchStyles.resultTitle} numberOfLines={1}>{title}</Text>
          {lastSegment ? <Text style={searchStyles.resultSubtitle} numberOfLines={1}>{lastSegment}</Text> : null}
        </TouchableOpacity>
      )
    },
    [router],
  )
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null)

  const serverTrees = useMemo((): ServerTree[] => {
    const serverIds: string[] = []
    const serverLabels: Record<string, string> = {}

    for (const s of sessions) {
      if (!serverLabels[s.serverId]) {
        serverIds.push(s.serverId)
        serverLabels[s.serverId] = s.serverLabel ?? s.serverId
      }
    }
    for (const c of conversations) {
      if (!serverLabels[c.serverId]) {
        serverIds.push(c.serverId)
        serverLabels[c.serverId] = c.serverLabel ?? c.serverId
      }
    }

    return serverIds.map((serverId) => {
      const sSessions = sessions.filter((s) => s.serverId === serverId)
      const sConversations = conversations.filter((c) => c.serverId === serverId)
      const raw = buildTree(sSessions, sConversations)
      const tree = compactTree(raw)

      const singleRootPath = tree.children.size === 1
        ? Array.from(tree.children.values())[0].fullPath
        : null
      const singleRootNode = singleRootPath
        ? Array.from(tree.children.values())[0]
        : null

      return { serverId, serverLabel: serverLabels[serverId], tree, singleRootPath, singleRootNode }
    })
  }, [sessions, conversations])

  const effectiveExpandedPaths = useMemo(() => {
    const merged = new Set(expandedPaths)
    for (const { singleRootPath } of serverTrees) {
      if (singleRootPath) merged.add(singleRootPath)
    }
    return merged
  }, [expandedPaths, serverTrees])

  const flatItems = useMemo((): FlatItem[] => {
    const items: FlatItem[] = []
    for (const { serverId, serverLabel, tree, singleRootPath, singleRootNode } of serverTrees) {
      if (singleRootNode && singleRootPath) {
        items.push({ kind: 'server-root', serverId, serverLabel, node: singleRootNode })
        for (const fn of flattenVisible(singleRootNode.children, 1, effectiveExpandedPaths)) {
          items.push({ kind: 'tree-row', serverId, node: fn.node, depth: fn.depth, depthOffset: 1 })
        }
      } else {
        for (const fn of flattenVisible(tree.children, 0, effectiveExpandedPaths)) {
          items.push({ kind: 'tree-row', serverId, node: fn.node, depth: fn.depth, depthOffset: 0 })
        }
      }
    }
    return items
  }, [serverTrees, effectiveExpandedPaths])

  const handleToggle = useCallback((path: string) => {
    if (serverTrees.some((st) => st.singleRootPath === path)) return
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [serverTrees])

  const handleSelectLeaf = useCallback((node: TreeNode) => {
    setSelectedNode(node)
  }, [])

  if (selectedNode && !searchOpen) {
    return (
      <DrillView
        node={selectedNode}
        onBack={() => setSelectedNode(null)}
      />
    )
  }

  const showSearch = searchOpen && debouncedQuery.length > 0

  return (
    <View style={{ flex: 1 }}>
      {searchOpen ? (
        <View style={searchStyles.searchBar}>
          <TextInput
            ref={inputRef}
            style={searchStyles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search sessions & conversations…"
            placeholderTextColor="#7d8590"
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      ) : null}

      {showSearch ? (
        searchSections.length === 0 ? (
          <EmptyState title="No results" subtitle={`Nothing matched "${debouncedQuery}"`} />
        ) : (
          <SectionList
            sections={searchSections}
            keyExtractor={(item) => ('status' in item ? `s-${item.id}` : `c-${item.id}`)}
            renderItem={renderSearchItem}
            renderSectionHeader={({ section }) => (
              <View style={searchStyles.sectionHeader}>
                <Text style={searchStyles.sectionHeaderText}>{section.title}</Text>
              </View>
            )}
            contentContainerStyle={searchStyles.listContent}
            stickySectionHeadersEnabled={false}
          />
        )
      ) : (
        <FlatList
          data={flatItems}
          keyExtractor={(item) =>
            item.kind === 'server-root'
              ? `root-${item.serverId}`
              : `row-${item.serverId}-${item.node.fullPath}`
          }
          renderItem={({ item }) => {
            if (item.kind === 'server-root') {
              return (
                <ServerRootRow
                  node={item.node}
                  serverLabel={item.serverLabel}
                  onSelectLeaf={handleSelectLeaf}
                />
              )
            }
            return (
              <TreeRow
                node={item.node}
                depth={item.depth}
                depthOffset={item.depthOffset}
                isExpanded={effectiveExpandedPaths.has(item.node.fullPath)}
                onToggle={handleToggle}
                onSelectLeaf={handleSelectLeaf}
              />
            )
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7d8590"
            />
          }
          contentContainerStyle={flatItems.length === 0 ? styles.emptyContainer : styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No projects yet</Text>
          }
        />
      )}
    </View>
  )
}
