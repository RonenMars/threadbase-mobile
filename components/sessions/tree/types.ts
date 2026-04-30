import type { MultiSession, MultiConversation } from '@/types/api'

export interface TreeNode {
  name: string
  fullPath: string
  children: Map<string, TreeNode>
  sessions: MultiSession[]
  conversations: MultiConversation[]
  totalCount: number
}

export interface FlatNode {
  node: TreeNode
  depth: number
}

export type FlatItem =
  | { kind: 'server-root'; serverId: string; serverLabel: string; node: TreeNode }
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
  time: string
  status?: string
  onPress: () => void
}

export interface TreeSessionsListProps {
  sessions: MultiSession[]
  conversations: MultiConversation[]
  refreshing: boolean
  onRefresh: () => void
  searchOpen?: boolean
}
