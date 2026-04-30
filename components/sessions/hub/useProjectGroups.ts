import { useMemo } from 'react'
import type { MultiSession, MultiConversation } from '../../../types/api'
import type { SortBy, SortOrder } from '../../../types/ui'

export interface ProjectGroup {
  projectPath: string
  projectName: string
  sessions: MultiSession[]
  conversations: MultiConversation[]
  latestActivityMs: number
  earliestStartMs: number
}

const STATUS_PRIORITY: Record<string, number> = {
  running: 0,
  waiting_input: 1,
  idle: 2,
  failed: 3,
  completed: 4,
}

function toMs(isoString: string | undefined): number {
  if (!isoString) return 0
  const ms = Date.parse(isoString)
  return isNaN(ms) ? 0 : ms
}

export function useProjectGroups(
  sessions: MultiSession[],
  conversations: MultiConversation[],
  sortBy: SortBy,
  sortOrder: SortOrder,
): ProjectGroup[] {
  return useMemo(() => {
    const map = new Map<string, ProjectGroup>()

    for (const session of sessions) {
      const key = session.projectPath
      if (!map.has(key)) {
        map.set(key, {
          projectPath: key,
          projectName: session.projectName,
          sessions: [],
          conversations: [],
          latestActivityMs: 0,
          earliestStartMs: Infinity,
        })
      }
      const group = map.get(key)!
      group.sessions.push(session)

      const startMs = toMs(session.startedAt)
      const activityMs = session.completedAt
        ? toMs(session.completedAt)
        : startMs + (session.elapsedMs ?? 0)

      if (activityMs > group.latestActivityMs) {
        group.latestActivityMs = activityMs
      }
      if (startMs > 0 && startMs < group.earliestStartMs) {
        group.earliestStartMs = startMs
      }
    }

    for (const conversation of conversations) {
      const key = conversation.projectPath
      if (!map.has(key)) {
        map.set(key, {
          projectPath: key,
          projectName: key,
          sessions: [],
          conversations: [],
          latestActivityMs: 0,
          earliestStartMs: Infinity,
        })
      }
      const group = map.get(key)!
      group.conversations.push(conversation)

      const lastActivityMs = toMs(conversation.lastActivity)
      if (lastActivityMs > group.latestActivityMs) {
        group.latestActivityMs = lastActivityMs
      }
    }

    const groups = Array.from(map.values())

    // Normalise earliestStartMs for groups that only have conversations
    for (const group of groups) {
      if (group.earliestStartMs === Infinity) {
        group.earliestStartMs = 0
      }
    }

    // Sort conversations within each group by lastActivity desc
    for (const group of groups) {
      group.conversations.sort(
        (a, b) => toMs(b.lastActivity) - toMs(a.lastActivity),
      )
    }

    // Sort groups
    groups.sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'projectName':
          cmp = a.projectName.localeCompare(b.projectName)
          break
        case 'lastActivity':
          cmp = b.latestActivityMs - a.latestActivityMs
          break
        case 'startedAt':
          cmp = b.earliestStartMs - a.earliestStartMs
          break
        case 'status': {
          const aPriority = Math.min(
            ...a.sessions.map((s) => STATUS_PRIORITY[s.status] ?? 5),
            5,
          )
          const bPriority = Math.min(
            ...b.sessions.map((s) => STATUS_PRIORITY[s.status] ?? 5),
            5,
          )
          cmp = aPriority - bPriority
          break
        }
      }
      return sortOrder === 'asc' ? -cmp : cmp
    })

    return groups
  }, [sessions, conversations, sortBy, sortOrder])
}
