import { useMemo } from 'react'
import type { ProjectGroup } from './useProjectGroups'

export interface ServerGroup {
  serverId: string
  serverLabel: string
  groups: ProjectGroup[]
  totalCount: number
}

export function useServerGroups(
  projectGroups: ProjectGroup[],
  activeServerIds: string[],
  serverLabels: Record<string, string>,
): ServerGroup[] {
  return useMemo(() => {
    if (activeServerIds.length <= 1) return []

    const map = new Map<string, ServerGroup>()

    for (const group of projectGroups) {
      const allItems = [...group.sessions, ...group.conversations]
      for (const item of allItems) {
        const serverId = item.serverId
        if (!map.has(serverId)) {
          map.set(serverId, {
            serverId,
            serverLabel: serverLabels[serverId] ?? serverId,
            groups: [],
            totalCount: 0,
          })
        }
      }
    }

    for (const group of projectGroups) {
      const serverIds = new Set([
        ...group.sessions.map((s) => s.serverId),
        ...group.conversations.map((c) => c.serverId),
      ])
      for (const serverId of serverIds) {
        const serverGroup = map.get(serverId)
        if (serverGroup) {
          const filteredGroup: ProjectGroup = {
            ...group,
            sessions: group.sessions.filter((s) => s.serverId === serverId),
            conversations: group.conversations.filter((c) => c.serverId === serverId),
          }
          filteredGroup.latestActivityMs = Math.max(
            ...filteredGroup.sessions.map((s) =>
              s.completedAt ? Date.parse(s.completedAt) : Date.parse(s.startedAt) + (s.elapsedMs ?? 0),
            ),
            ...filteredGroup.conversations.map((c) => Date.parse(c.lastActivity) || 0),
            0,
          )
          serverGroup.groups.push(filteredGroup)
          serverGroup.totalCount +=
            filteredGroup.sessions.length + filteredGroup.conversations.length
        }
      }
    }

    return activeServerIds
      .map((id) => map.get(id))
      .filter((sg): sg is ServerGroup => sg !== undefined && sg.totalCount > 0)
  }, [projectGroups, activeServerIds, serverLabels])
}
