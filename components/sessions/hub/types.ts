import type { MultiSession, MultiConversation } from '@/types/api'
import type { SortBy, SortOrder } from '@/types/ui'

export type { ProjectGroup } from './useProjectGroups'

export type SearchSection = {
  title: string
  data: (MultiConversation | MultiSession)[]
  kind: 'conversation' | 'session'
}

export interface ProjectHubListProps {
  sessions: MultiSession[]
  conversations: MultiConversation[]
  sortBy: SortBy
  sortOrder: SortOrder
  refreshing: boolean
  onRefresh: () => void
  searchOpen: boolean
}

export interface ProjectHubCardProps {
  group: import('./useProjectGroups').ProjectGroup
  isOpen: boolean
  onToggle: () => void
}

export interface SessionRowProps {
  session: MultiSession
}

export interface ConvRowProps {
  conv: MultiConversation
}

export function isMultiSession(item: MultiConversation | MultiSession): item is MultiSession {
  return 'status' in item
}
