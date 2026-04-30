import React, { useMemo, useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  SectionList,
  StyleSheet,
  RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { dark, font, radius, spacing } from '@/constants/theme'
import { useSettingsStore } from '@/stores/settings'
import type { MultiSession, MultiConversation } from '@/types/api'

interface TreeNode {
  name: string
  fullPath: string
  children: Map<string, TreeNode>
  sessions: MultiSession[]
  conversations: MultiConversation[]
  totalCount: number
}

interface FlatNode {
  node: TreeNode
  depth: number
}

function buildTree(
  sessions: MultiSession[],
  conversations: MultiConversation[],
): TreeNode {
  const root: TreeNode = {
    name: '',
    fullPath: '',
    children: new Map(),
    sessions: [],
    conversations: [],
    totalCount: 0,
  }

  function ensurePath(parts: string[]): TreeNode {
    let cur = root
    let pathSoFar = ''
    for (const part of parts) {
      pathSoFar += '/' + part
      if (!cur.children.has(part)) {
        cur.children.set(part, {
          name: part,
          fullPath: pathSoFar,
          children: new Map(),
          sessions: [],
          conversations: [],
          totalCount: 0,
        })
      }
      cur = cur.children.get(part)!
    }
    return cur
  }

  for (const s of sessions) {
    const parts = s.projectPath.split('/').filter(Boolean)
    const node = ensurePath(parts)
    node.sessions.push(s)
  }

  for (const c of conversations) {
    const parts = c.projectPath.split('/').filter(Boolean)
    const node = ensurePath(parts)
    node.conversations.push(c)
  }

  function calcTotals(node: TreeNode): number {
    let count = node.sessions.length + node.conversations.length
    for (const child of node.children.values()) {
      count += calcTotals(child)
    }
    node.totalCount = count
    return count
  }
  calcTotals(root)

  return root
}

function compactTree(node: TreeNode): TreeNode {
  const compactedChildren = new Map<string, TreeNode>()
  for (const [, child] of node.children) {
    const compacted = compactTree(child)
    // Collapse single-child chains that have no items of their own
    if (
      compacted.children.size === 1 &&
      compacted.sessions.length === 0 &&
      compacted.conversations.length === 0
    ) {
      const [grandchild] = compacted.children.values()
      const merged: TreeNode = {
        ...grandchild,
        name: compacted.name + '/' + grandchild.name,
      }
      compactedChildren.set(merged.name, merged)
    } else {
      compactedChildren.set(compacted.name, compacted)
    }
  }
  return { ...node, children: compactedChildren }
}

function flattenVisible(
  children: Map<string, TreeNode>,
  depth: number,
  expandedPaths: Set<string>,
): FlatNode[] {
  const items: FlatNode[] = []
  const sorted = Array.from(children.values()).sort(
    (a, b) => b.totalCount - a.totalCount,
  )
  for (const node of sorted) {
    items.push({ node, depth })
    if (expandedPaths.has(node.fullPath) && node.children.size > 0) {
      items.push(...flattenVisible(node.children, depth + 1, expandedPaths))
    }
  }
  return items
}

function toMs(iso: string | undefined): number {
  if (!iso) return 0
  const ms = Date.parse(iso)
  return isNaN(ms) ? 0 : ms
}

function latestActivityLabel(node: TreeNode): string {
  let latest = 0
  for (const s of node.sessions) {
    const ms = s.completedAt
      ? toMs(s.completedAt)
      : toMs(s.startedAt) + (s.elapsedMs ?? 0)
    if (ms > latest) latest = ms
  }
  for (const c of node.conversations) {
    const ms = toMs(c.lastActivity)
    if (ms > latest) latest = ms
  }
  if (latest === 0) return ''
  const now = Date.now()
  const diff = now - latest
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const STATUS_COLOR: Record<string, string> = {
  running: dark.status.running,
  idle: dark.status.idle,
}

function activeSessionColor(node: TreeNode): string | null {
  const priority = ['running', 'idle']
  for (const status of priority) {
    if (node.sessions.some((s) => s.status === status)) {
      return STATUS_COLOR[status]
    }
  }
  return null
}

interface TreeRowProps {
  node: TreeNode
  depth: number
  isExpanded: boolean
  isLocked: boolean
  onToggle: (path: string) => void
  onSelectLeaf: (node: TreeNode) => void
}

function TreeRow({ node, depth, isExpanded, isLocked, onToggle, onSelectLeaf }: TreeRowProps) {
  const hasChildren = node.children.size > 0
  const hasItems = node.sessions.length + node.conversations.length > 0
  const isLeaf = !hasChildren
  const accentColor = activeSessionColor(node)
  const timeLabel = latestActivityLabel(node)

  const handlePress = () => {
    if (isLocked) return
    if (isLeaf) {
      onSelectLeaf(node)
    } else {
      onToggle(node.fullPath)
    }
  }

  const rowContent = (
    <>
      {/* Indent guide lines */}
      {Array.from({ length: depth }).map((_, i) => (
        <View
          key={i}
          style={[styles.indentLine, { left: spacing.md + i * 16 + 7 }]}
        />
      ))}

      {/* Expand chevron or leaf dot */}
      <View style={styles.iconSlot}>
        {isLocked ? null : hasChildren ? (
          <Text style={[styles.chevron, isExpanded && styles.chevronOpen]}>›</Text>
        ) : (
          <View style={[styles.leafDot, accentColor ? { backgroundColor: accentColor } : null]} />
        )}
      </View>

      {/* Label */}
      <Text
        style={[
          styles.label,
          hasItems && styles.labelWithItems,
          isLocked && styles.labelLocked,
          isLeaf && accentColor ? { color: accentColor } : null,
        ]}
        numberOfLines={1}
      >
        {node.name}
      </Text>

      {/* Right side: count badge + time */}
      <View style={styles.meta}>
        {node.totalCount > 0 && (
          <View style={[styles.badge, accentColor ? { backgroundColor: accentColor + '22' } : null]}>
            <Text style={[styles.badgeText, accentColor ? { color: accentColor } : null]}>
              {node.totalCount}
            </Text>
          </View>
        )}
        {timeLabel ? (
          <Text style={styles.time}>{timeLabel}</Text>
        ) : null}
      </View>
    </>
  )

  if (isLocked) {
    return (
      <View style={[styles.row, { paddingLeft: spacing.md + depth * 16 }]}>
        {rowContent}
      </View>
    )
  }

  return (
    <TouchableOpacity
      style={[styles.row, { paddingLeft: spacing.md + depth * 16 }]}
      onPress={handlePress}
      activeOpacity={0.65}
    >
      {rowContent}
    </TouchableOpacity>
  )
}

type DrillItem = { key: string; label: string; time: string; status?: string; onPress: () => void }

interface DrillViewProps {
  node: TreeNode
  onBack: () => void
}

function DrillRow({ item }: { item: DrillItem }) {
  return (
    <TouchableOpacity style={styles.drillRow} onPress={item.onPress} activeOpacity={0.65}>
      <View style={[styles.statusDot, { backgroundColor: item.status ? (STATUS_COLOR[item.status] ?? dark.text.secondary) : dark.text.secondary }]} />
      <View style={styles.drillContent}>
        <Text style={styles.drillLabel} numberOfLines={1}>{item.label}</Text>
        {item.status ? (
          <Text style={[styles.drillStatus, { color: STATUS_COLOR[item.status] ?? dark.text.secondary }]}>
            {item.status.replace('_', ' ')}
          </Text>
        ) : null}
      </View>
      <Text style={styles.drillTime}>{item.time}</Text>
    </TouchableOpacity>
  )
}

function DrillView({ node, onBack }: DrillViewProps) {
  const router = useRouter()
  const mergeChats = useSettingsStore((s) => s.mergeChats)

  const sessionItems: DrillItem[] = node.sessions.map((s) => ({
    key: `s-${s.id}`,
    label: s.projectName || s.projectPath,
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
    const allItems = [...sessionItems, ...conversationItems].sort((a, b) => {
      // keep original order (sessions first within each group, conversations after)
      return 0
    })
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

interface Props {
  sessions: MultiSession[]
  conversations: MultiConversation[]
  refreshing: boolean
  onRefresh: () => void
}

export function TreeSessionsList({ sessions, conversations, refreshing, onRefresh }: Props) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null)

  const tree = useMemo(() => {
    const raw = buildTree(sessions, conversations)
    return compactTree(raw)
  }, [sessions, conversations])

  // If there is exactly one root node, keep it permanently expanded and
  // seed expandedPaths with it so it renders open from the first frame.
  const singleRootPath = tree.children.size === 1
    ? Array.from(tree.children.values())[0].fullPath
    : null

  const effectiveExpandedPaths = useMemo(() => {
    if (!singleRootPath) return expandedPaths
    const merged = new Set(expandedPaths)
    merged.add(singleRootPath)
    return merged
  }, [expandedPaths, singleRootPath])

  const flatNodes = useMemo(
    () => flattenVisible(tree.children, 0, effectiveExpandedPaths),
    [tree, effectiveExpandedPaths],
  )

  const handleToggle = useCallback((path: string) => {
    // Single root can never be collapsed
    if (path === singleRootPath) return
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [singleRootPath])

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
      data={flatNodes}
      keyExtractor={(item) => item.node.fullPath}
      renderItem={({ item }) => (
        <TreeRow
          node={item.node}
          depth={item.depth}
          isExpanded={effectiveExpandedPaths.has(item.node.fullPath)}
          isLocked={item.node.fullPath === singleRootPath}
          onToggle={handleToggle}
          onSelectLeaf={handleSelectLeaf}
        />
      )}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={dark.text.secondary}
        />
      }
      contentContainerStyle={flatNodes.length === 0 ? styles.emptyContainer : undefined}
      ListEmptyComponent={
        <Text style={styles.emptyText}>No projects yet</Text>
      }
    />
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingRight: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.border,
    minHeight: 44,
  },
  indentLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: dark.border,
    opacity: 0.5,
  },
  iconSlot: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
    flexShrink: 0,
  },
  chevron: {
    fontSize: 18,
    color: dark.text.secondary,
    lineHeight: 20,
    marginTop: -1,
  },
  chevronOpen: {
    transform: [{ rotate: '90deg' }],
    color: dark.text.accent,
  },
  leafDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: dark.text.secondary,
  },
  label: {
    flex: 1,
    fontSize: font.sm,
    color: dark.text.secondary,
    fontFamily: 'monospace',
  },
  labelWithItems: {
    color: dark.text.primary,
    fontWeight: '500',
  },
  labelLocked: {
    color: dark.text.secondary,
    fontWeight: '400',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: spacing.xs,
    flexShrink: 0,
  },
  badge: {
    backgroundColor: 'rgba(88,166,255,0.12)',
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: font.xs,
    color: dark.text.accent,
    fontWeight: '600',
  },
  time: {
    fontSize: font.xs,
    color: dark.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: dark.text.secondary,
    fontSize: font.base,
    marginTop: 60,
    textAlign: 'center',
  },
  // Drill view
  drill: {
    flex: 1,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.border,
    gap: spacing.xs,
    minHeight: 44,
  },
  backChevron: {
    fontSize: 22,
    color: dark.text.accent,
    lineHeight: 24,
    marginTop: -1,
  },
  backLabel: {
    fontSize: font.base,
    fontWeight: '600',
    color: dark.text.primary,
    fontFamily: 'monospace',
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    fontSize: font.xs,
    fontWeight: '600',
    color: dark.text.secondary,
    backgroundColor: dark.bg.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  drillList: {
    paddingBottom: 80,
  },
  drillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.border,
    gap: spacing.sm,
    minHeight: 52,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  drillContent: {
    flex: 1,
  },
  drillLabel: {
    fontSize: font.sm,
    color: dark.text.primary,
    fontWeight: '500',
  },
  drillStatus: {
    fontSize: font.xs,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  drillTime: {
    fontSize: font.xs,
    color: dark.text.secondary,
    flexShrink: 0,
  },
})
