import type { MultiSession, MultiConversation } from '@/types/api'

export interface TreeNode {
  name: string
  fullPath: string
  children: Map<string, TreeNode>
  sessions: MultiSession[]
  conversations: MultiConversation[]
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
  conversations: MultiConversation[]
  refreshing: boolean
  onRefresh: () => void
  searchOpen?: boolean
}
