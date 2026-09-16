import { formatListTime } from '@/components/sessions/shared/formatListTime'
import { pathSegments } from '@/components/sessions/shared/pathTail'
import {
  deriveSessionPresentation,
  isPresentationLive,
  type SessionTier,
} from '@/lib/sessionPresentation'
import type { MultiSession } from '@/types/api'
import type { MultiProjectSummary } from '@/hooks/useProjectSummaries'
import type { TreeNode, FlatNode } from './types'
import i18n from '@/lib/i18n'

// Brand palette for the tree leaf indicator. Live (running / waiting_input)
// gets amber, the brand "now" colour. Idle gets blue, the brand "thread /
// archive" colour. Matches the hub rail and SessionStatusBadge dots so the
// same node reads identically across hub and tree.
const TIER_COLOR: Record<SessionTier, string> = {
  needsYou: '#d29922',
  working: '#3fb950',
  observed: '#58a6ff',
  cantResume: '#f85149',
  resumable: '#58a6ff',
}
// Most urgent first; the first tier present decides the leaf colour.
const TIER_PRIORITY: SessionTier[] = ['needsYou', 'working', 'observed', 'cantResume', 'resumable']

function splitPath(p: string | null | undefined): string[] {
  // Becomes a real tree node's name (TreeRow / DrillView render node.name), so
  // it must be translated rather than treated as an internal placeholder.
  if (!p) return [i18n.t('sessions:tree.unknownPath')]
  // Normalize Windows backslashes to forward slashes.
  // Keep the drive letter as the first segment (e.g. "C:" → ["C:", "Users", ...])
  // so Windows paths stay isolated from Unix /Users/... paths.
  // Strip leading UNC "\\server" prefix down to just the server name.
  return pathSegments(p.replace(/\\/g, '/'))
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
  if (node.sessions.length === 0) return null
  const tiers = new Set(node.sessions.map((s) => deriveSessionPresentation(s).tier))
  const tier = TIER_PRIORITY.find((candidate) => tiers.has(candidate))
  return tier ? TIER_COLOR[tier] : null
}

/**
 * Whether a tree node has at least one session that is currently live
 * (running or waiting_input). Used by TreeRow to decide whether the leaf
 * dot should pulse.
 */
export function hasLiveSession(node: TreeNode): boolean {
  return node.sessions.some(isPresentationLive)
}

function walkSubtree(node: TreeNode, visit: (n: TreeNode) => void) {
  visit(node)
  for (const child of node.children.values()) walkSubtree(child, visit)
}

/** Latest activity anywhere under this folder, including descendants. */
export function subtreeLatestActivityMs(node: TreeNode): number {
  let latest = 0
  walkSubtree(node, (n) => {
    latest = Math.max(latest, latestActivityMs(n))
  })
  return latest
}

/** Most urgent live colour anywhere under this folder. */
export function subtreeActiveColor(node: TreeNode): string | null {
  const tiers = new Set<SessionTier>()
  walkSubtree(node, (n) => {
    for (const session of n.sessions) tiers.add(deriveSessionPresentation(session).tier)
  })
  const tier = TIER_PRIORITY.find((candidate) => tiers.has(candidate))
  return tier ? TIER_COLOR[tier] : null
}

export function subtreeHasLive(node: TreeNode): boolean {
  let live = false
  walkSubtree(node, (n) => {
    if (hasLiveSession(n)) live = true
  })
  return live
}

/** The node a summary landed on, by the server's own project_path; falls back to the reassembled path. */
export function findProjectNode(node: TreeNode, projectPath: string): TreeNode | null {
  if (node.projectPath === projectPath || (node.fullPath !== '' && node.fullPath === projectPath)) return node
  for (const child of node.children.values()) {
    const found = findProjectNode(child, projectPath)
    if (found) return found
  }
  return null
}
