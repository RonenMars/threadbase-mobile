import type { MultiSession } from '@/types/api'
import type { MultiProjectSummary } from '@/hooks/useProjectSummaries'

export interface TreeNode {
  name: string
  fullPath: string
  children: Map<string, TreeNode>
  sessions: MultiSession[]
  /** The server's own project_path for this node, verbatim from the summary.
   *  `fullPath` is reassembled from split segments and always Unix-style, so it
   *  is not safe to send back as ?project= (a Windows `C:\dev\x` would go out
   *  as `/C:/dev/x` and match nothing). Set only on nodes a summary landed on. */
  projectPath?: string
  /** Conversations at this exact path, from /api/projects/summary — a count,
   *  not the rows. The rows are fetched only when the node is opened
   *  (DrillView), which is what keeps the tree off the eager drain. */
  conversationCount: number
  /** Most recent conversation activity at this exact path, epoch ms (0 when
   *  the node has no conversations of its own). */
  conversationActivityMs: number
  totalCount: number
  directCount: number
}

export interface FlatNode {
  node: TreeNode
  depth: number
}

export type FlatItem =
  | { kind: 'server-root'; serverId: string; serverLabel: string; node: TreeNode; collapsible: boolean; isExpanded: boolean }
  | { kind: 'tree-row'; serverId: string; node: TreeNode; depth: number; depthOffset: number }
  | { kind: 'server-unsupported'; serverId: string; serverLabel: string }

export interface ServerTree {
  serverId: string
  serverLabel: string
  tree: TreeNode
  singleRootPath: string | null
  singleRootNode: TreeNode | null
}

export type DrillItem = {
  key: string
  label: string
  /** Raw timestamp — the row formats it via formatListTime. */
  timestamp: string | number | null
  messageCount?: number
  lastOutput?: string | null
  firstMessage?: { text: string } | null
  lastMessage?: { text: string } | null
  branch?: string | null
  status?: string
  serverId?: string
  serverLabel?: string
  provider?: 'claude-code' | 'codex-cli'
  onPress: () => void
}

export interface TreeSessionsListProps {
  sessions: MultiSession[]
  summaries: MultiProjectSummary[]
  refreshing: boolean
  onRefresh: () => void
  searchOpen?: boolean
  isBackgroundRefreshing?: boolean
  /** Servers whose streamer predates /api/projects/summary — the tree can't be
   *  built for them, so the list renders an upgrade prompt instead. */
  unsupportedServerIds?: string[]
}
