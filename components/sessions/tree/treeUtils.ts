import { formatListTime } from '@/components/sessions/shared/formatListTime'
import type { MultiSession } from '@/types/api'
import type { MultiProjectSummary } from '@/hooks/useProjectSummaries'
import type { TreeNode, FlatNode } from './types'
import i18n from '@/lib/i18n'

// Brand palette for the tree leaf indicator. Live (running / waiting_input)
// gets amber, the brand "now" colour. Idle gets blue, the brand "thread /
// archive" colour. Matches SessionCard's spine and SessionStatusBadge dots
// so the same node reads identically across hub, classic, and tree modes.
export const STATUS_COLOR: Record<string, string> = {
  running: '#d29922',
  waiting_input: '#d29922',
  idle: '#58a6ff',
}

function splitPath(p: string | null | undefined): string[] {
  // Becomes a real tree node's name (TreeRow / DrillView render node.name), so
  // it must be translated rather than treated as an internal placeholder.
  if (!p) return [i18n.t('sessions:tree.unknownPath')]
  // Normalize Windows backslashes to forward slashes.
  // Keep the drive letter as the first segment (e.g. "C:" → ["C:", "Users", ...])
  // so Windows paths stay isolated from Unix /Users/... paths.
  // Strip leading UNC "\\server" prefix down to just the server name.
  return p.replace(/\\/g, '/').split('/').filter(Boolean)
}

export function buildTree(
  sessions: MultiSession[],
  summaries: MultiProjectSummary[],
): TreeNode {
  const root: TreeNode = {
    name: '',
    fullPath: '',
    children: new Map(),
    sessions: [],
    conversationCount: 0,
    conversationActivityMs: 0,
    totalCount: 0,
    directCount: 0,
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
          conversationCount: 0,
          conversationActivityMs: 0,
          totalCount: 0,
          directCount: 0,
        })
      }
      cur = cur.children.get(part)!
    }
    return cur
  }

  for (const s of sessions) {
    const parts = splitPath(s.projectPath)
    ensurePath(parts).sessions.push(s)
  }

  // A summary is one project path with a count, so it lands on exactly one
  // node. Two summaries can share a node only across servers, and the tree is
  // already partitioned per server before this runs — hence += rather than =.
  for (const summary of summaries) {
    const node = ensurePath(splitPath(summary.path))
    node.projectPath = summary.path
    node.conversationCount += summary.conversationCount
    node.conversationActivityMs = Math.max(
      node.conversationActivityMs,
      toMs(summary.lastActivity),
    )
  }

  function calcTotals(node: TreeNode): number {
    const direct = node.sessions.length + node.conversationCount
    let count = direct
    for (const child of node.children.values()) {
      count += calcTotals(child)
    }
    node.directCount = direct
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
      compacted.conversationCount === 0
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

export function latestActivityMs(node: TreeNode): number {
  let latest = 0
  for (const s of node.sessions) {
    const ms = s.completedAt
      ? toMs(s.completedAt)
      : toMs(s.startedAt) + (s.elapsedMs ?? 0)
    if (ms > latest) latest = ms
  }
  if (node.conversationActivityMs > latest) latest = node.conversationActivityMs
  return latest
}

export function latestActivityLabel(node: TreeNode): string {
  const latest = latestActivityMs(node)
  if (latest === 0) return ''
  return formatListTime(latest)
}

export function activeSessionColor(node: TreeNode): string | null {
  // Priority: live first (running / waiting_input both map to amber), then
  // idle. The first matching status decides the leaf colour for the node.
  const priority = ['running', 'waiting_input', 'idle']
  for (const status of priority) {
    if (node.sessions.some((s) => s.status === status)) {
      return STATUS_COLOR[status]
    }
  }
  return null
}

/**
 * Whether a tree node has at least one session that is currently live
 * (running or waiting_input). Used by TreeRow to decide whether the leaf
 * dot should pulse.
 */
export function hasLiveSession(node: TreeNode): boolean {
  return node.sessions.some((s) => s.status === 'running' || s.status === 'waiting_input')
}
