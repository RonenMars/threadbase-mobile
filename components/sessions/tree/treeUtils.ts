import { dark } from '@/constants/theme'
import type { MultiSession, MultiConversation } from '@/types/api'
import type { TreeNode, FlatNode } from './types'

export const STATUS_COLOR: Record<string, string> = {
  running: dark.status.running,
  idle: dark.status.idle,
}

export function buildTree(
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
    ensurePath(parts).sessions.push(s)
  }

  for (const c of conversations) {
    const parts = c.projectPath.split('/').filter(Boolean)
    ensurePath(parts).conversations.push(c)
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

export function compactTree(node: TreeNode): TreeNode {
  const compactedChildren = new Map<string, TreeNode>()
  for (const [, child] of node.children) {
    const compacted = compactTree(child)
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

export function flattenVisible(
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

export function toMs(iso: string | undefined): number {
  if (!iso) return 0
  const ms = Date.parse(iso)
  return isNaN(ms) ? 0 : ms
}

export function latestActivityLabel(node: TreeNode): string {
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

export function activeSessionColor(node: TreeNode): string | null {
  const priority = ['running', 'idle']
  for (const status of priority) {
    if (node.sessions.some((s) => s.status === status)) {
      return STATUS_COLOR[status]
    }
  }
  return null
}
