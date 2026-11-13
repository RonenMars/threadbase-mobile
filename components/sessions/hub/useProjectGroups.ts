import { useMemo } from 'react'
import type { MultiSession } from '../../../types/api'
import type { MultiProjectSummary } from '@/hooks/useProjectSummaries'
import { liveExternalCountOf } from '@/lib/externalSession'
import type { SortBy, SortOrder } from '../../../types/ui'
import { sessionActivityMs } from '@/lib/sessionActivity'

export interface ProjectGroup {
  /** Backend-stable project identity. Falls back to projectPath while
   *  the backend rolls out projectId support. */
  projectId: string
  projectPath: string
  projectName: string
  /** Groups are per (serverId, projectPath) — the key the per-group
   *  conversation query is issued under. */
  serverId: string
  sessions: MultiSession[]
  /** Conversation count from /api/projects/summary. The rows themselves are
   *  fetched by the card when it opens, so a collapsed group costs nothing. */
  conversationCount: number
  /** Conversations in this project running outside Threadbase, from the summary. */
  liveExternalCount: number
  latestActivityMs: number
  earliestStartMs: number
}

function toMs(isoString: string | undefined): number {
  if (!isoString) return 0
  const ms = Date.parse(isoString)
  return isNaN(ms) ? 0 : ms
}

export function useProjectGroups(
  sessions: MultiSession[],
  summaries: MultiProjectSummary[],
  sortBy: SortBy,
  sortOrder: SortOrder,
): ProjectGroup[] {
  return useMemo(() => {
    const map = new Map<string, ProjectGroup>()
    // Keyed by (serverId, projectPath), never projectId: the streamer sends
    // projectId null for external and historical sessions at a path whose
    // other sessions carry one, and a path is distinct per server.
    const keyOf = (serverId: string, projectPath: string) => `${serverId}::${projectPath}`

    for (const session of sessions) {
      const key = keyOf(session.serverId, session.projectPath)
      if (!map.has(key)) {
        map.set(key, {
          projectId: session.projectId ?? session.projectPath,
          projectPath: session.projectPath,
          projectName: session.projectName,
          serverId: session.serverId,
          sessions: [],
          conversationCount: 0,
          liveExternalCount: 0,
          latestActivityMs: 0,
          earliestStartMs: Infinity,
        })
      }
      const group = map.get(key)!
      group.sessions.push(session)
      // First session with a projectId wins; the path fallback is only a placeholder.
      if (session.projectId && group.projectId === group.projectPath) {
        group.projectId = session.projectId
      }

      const startMs = toMs(session.startedAt)
      const activityMs = sessionActivityMs(session)

      if (activityMs > group.latestActivityMs) {
        group.latestActivityMs = activityMs
      }
      if (startMs > 0 && startMs < group.earliestStartMs) {
        group.earliestStartMs = startMs
      }
    }

    for (const summary of summaries) {
      const pathKey = keyOf(summary.serverId, summary.path)
      const group =
        map.get(pathKey) ??
        (() => {
          const created: ProjectGroup = {
            projectId: summary.path,
            projectPath: summary.path,
            projectName: summary.name,
            serverId: summary.serverId,
            sessions: [],
            conversationCount: 0,
            liveExternalCount: 0,
            latestActivityMs: 0,
            earliestStartMs: Infinity,
          }
          map.set(pathKey, created)
          return created
        })()

      group.conversationCount += summary.conversationCount
      group.liveExternalCount += liveExternalCountOf(summary)
      const lastActivityMs = toMs(summary.lastActivity)
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

    // Sort groups
    groups.sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'projectName':
          cmp = a.projectName.localeCompare(b.projectName)
          break
        case 'state':
        case 'lastActivity':
          cmp = b.latestActivityMs - a.latestActivityMs
          break
      }
      return sortOrder === 'asc' ? -cmp : cmp
    })

    return groups
  }, [sessions, summaries, sortBy, sortOrder])
}
