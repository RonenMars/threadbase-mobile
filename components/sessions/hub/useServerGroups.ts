import { useMemo } from 'react'
import type { ProjectGroup } from './useProjectGroups'

function toMs(isoString: string | undefined): number {
  if (!isoString) return 0
  const ms = Date.parse(isoString)
  return isNaN(ms) ? 0 : ms
}

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
              s.completedAt ? toMs(s.completedAt) : toMs(s.startedAt) + (s.elapsedMs ?? 0),
            ),
            ...filteredGroup.conversations.map((c) => toMs(c.lastActivity)),
            0,
          )
          filteredGroup.earliestStartMs = filteredGroup.sessions.length > 0
            ? Math.min(...filteredGroup.sessions.map((s) => toMs(s.startedAt)).filter((ms) => ms > 0))
            : 0
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
