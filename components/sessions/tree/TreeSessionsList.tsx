import React, { useMemo, useState, useCallback } from 'react'
import { Text, FlatList, RefreshControl } from 'react-native'
import { buildTree, compactTree, flattenVisible } from './treeUtils'
import { TreeRow } from './TreeRow'
import { DrillView } from './DrillView'
import { ServerRootRow } from './ServerRootRow'
import { styles } from './TreeSessionsList.styles'
import type { FlatItem, ServerTree, TreeNode, TreeSessionsListProps } from './types'

export function TreeSessionsList({ sessions, conversations, refreshing, onRefresh }: TreeSessionsListProps) {
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

  if (selectedNode) {
    return (
      <DrillView
        node={selectedNode}
        onBack={() => setSelectedNode(null)}
      />
    )
  }

  return (
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
  )
}
