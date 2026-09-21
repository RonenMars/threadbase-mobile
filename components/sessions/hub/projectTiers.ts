import { deriveSessionPresentation, isPresentationLive, type SessionColorToken } from '@/lib/sessionPresentation'
import type { ProjectGroup } from './useProjectGroups'

export type ProjectTier = 'active' | 'recent' | 'older'

/** A project with no live session and nothing inside this window is long-tail. */
export const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export function projectTier(group: ProjectGroup, now: number = Date.now()): ProjectTier {
  if (group.sessions.some(isPresentationLive)) return 'active'
  return now - group.latestActivityMs <= RECENT_WINDOW_MS ? 'recent' : 'older'
}

export interface ProjectTiers {
  active: ProjectGroup[]
  recent: ProjectGroup[]
  older: ProjectGroup[]
}

/** Buckets the groups by tier, keeping the incoming order inside each tier. */
export function splitProjectTiers(groups: ProjectGroup[], now: number = Date.now()): ProjectTiers {
  const tiers: ProjectTiers = { active: [], recent: [], older: [] }
  for (const group of groups) tiers[projectTier(group, now)].push(group)
  return tiers
}

/** The rail takes the colour of the most urgent live session; a card with none has no rail. */
export function projectRailToken(group: ProjectGroup): SessionColorToken | null {
  let token: SessionColorToken | null = null
  for (const session of group.sessions) {
    const presentation = deriveSessionPresentation(session)
    if (!presentation.live) continue
    if (presentation.tier === 'needsYou') return 'waiting'
    if (presentation.tier === 'working') token = 'running'
    else if (token == null) token = presentation.colorToken
  }
  return token
}

export function matchesProjectFilter(group: ProjectGroup, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return group.projectName.toLowerCase().includes(q) || group.projectPath.toLowerCase().includes(q)
}
