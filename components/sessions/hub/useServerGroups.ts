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

    // Always seed every active server so offline / empty hosts still get a
    // section header instead of vanishing from the hub.
    const map = new Map<string, ServerGroup>()
    for (const serverId of activeServerIds) {
      map.set(serverId, {
        serverId,
        serverLabel: serverLabels[serverId] ?? serverId,
        groups: [],
        totalCount: 0,
      })
    }

    // Groups are already built per (serverId, projectPath), so this is a
    // bucketing pass — no per-server re-derivation of the group's own totals.
    for (const group of projectGroups) {
      const serverGroup = map.get(group.serverId)
      if (!serverGroup) continue
      serverGroup.groups.push(group)
      serverGroup.totalCount += group.sessions.length + group.conversationCount
    }

    return activeServerIds
      .map((id) => map.get(id))
      .filter((sg): sg is ServerGroup => sg !== undefined)
  }, [projectGroups, activeServerIds, serverLabels])
}
