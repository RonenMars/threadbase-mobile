import { useMemo } from 'react'
import type { MultiSession } from '../../../types/api'
import type { MultiProjectSummary } from '@/hooks/useProjectSummaries'
import type { SortBy, SortOrder } from '../../../types/ui'

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
  summaries: MultiProjectSummary[],
  sortBy: SortBy,
  sortOrder: SortOrder,
): ProjectGroup[] {
  return useMemo(() => {
    const map = new Map<string, ProjectGroup>()
    // A project path can exist on more than one server and they are distinct
    // groups, so the map key carries the server too.
    const keyOf = (serverId: string, projectKey: string) => `${serverId}::${projectKey}`

    for (const session of sessions) {
      // Prefer projectId for grouping; fall back to projectPath while
      // backend migration is in progress.
      const key = keyOf(session.serverId, session.projectId ?? session.projectPath)
      if (!map.has(key)) {
        map.set(key, {
          projectId: session.projectId ?? session.projectPath,
          projectPath: session.projectPath,
          projectName: session.projectName,
          serverId: session.serverId,
          sessions: [],
          conversationCount: 0,
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

    // Sessions key on projectId when they have one, so a summary (which only
    // knows the path) has to be matched by path, or a project with a live
    // session would render as two cards.
    const byPath = new Map<string, ProjectGroup>()
    for (const group of map.values()) {
      byPath.set(keyOf(group.serverId, group.projectPath), group)
    }

    for (const summary of summaries) {
      const pathKey = keyOf(summary.serverId, summary.path)
      const group =
        byPath.get(pathKey) ??
        (() => {
          const created: ProjectGroup = {
            projectId: summary.path,
            projectPath: summary.path,
            projectName: summary.name,
            serverId: summary.serverId,
            sessions: [],
            conversationCount: 0,
            latestActivityMs: 0,
            earliestStartMs: Infinity,
          }
          map.set(pathKey, created)
          byPath.set(pathKey, created)
          return created
        })()

      group.conversationCount += summary.conversationCount
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
  }, [sessions, summaries, sortBy, sortOrder])
}
