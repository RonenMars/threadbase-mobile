import type { ReactElement } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import type { MultiSession, MultiConversation } from '@/types/api'
import type { MultiProjectSummary } from '@/hooks/useProjectSummaries'
import type { SortBy, SortOrder } from '@/types/ui'

export type { ProjectGroup } from './useProjectGroups'

export type SearchSection = {
  title: string
  data: (MultiConversation | MultiSession)[]
  kind: 'conversation' | 'session'
}

export interface ProjectHubListProps {
  sessions: MultiSession[]
  summaries: MultiProjectSummary[]
  sortBy: SortBy
  sortOrder: SortOrder
  refreshing: boolean
  onRefresh: () => void
  searchOpen: boolean
  /** Typed in the chrome's search field; debounced and sent to /api/search here. */
  searchQuery: string
  isBackgroundRefreshing?: boolean
  /** Servers whose streamer predates /api/projects/summary — their projects
   *  can't be listed, so the hub shows an upgrade prompt for them. */
  unsupportedServerIds?: string[]
  /** Height of the floating chrome; the cards scroll under it. */
  topInset?: number
  /** Scrolls with the cards: the quick-access strip and banners. */
  ListHeaderComponent?: ReactElement | null
  onNewSession?: () => void
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
  onRetryServer?: (serverId: string) => void
  onOpenStatus?: () => void
}

export interface ProjectHubCardProps {
  group: import('./useProjectGroups').ProjectGroup
  isOpen: boolean
  onToggle: (projectId: string) => void
  forceServerChip?: boolean
}

export interface SessionRowProps {
  session: MultiSession
  forceServerChip?: boolean
}

export interface ConvRowProps {
  conv: MultiConversation
  onLongPress?: (conv: MultiConversation) => void
  forceServerChip?: boolean
}

export function isMultiSession(item: MultiConversation | MultiSession): item is MultiSession {
  return 'status' in item
}
