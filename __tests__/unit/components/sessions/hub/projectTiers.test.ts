import { matchesProjectFilter, projectRailToken, projectTier, RECENT_WINDOW_MS, splitProjectTiers } from '@/components/sessions/hub/projectTiers'
import type { ProjectGroup } from '@/components/sessions/hub/useProjectGroups'
import type { MultiSession } from '@/types/api'

const NOW = Date.parse('2026-09-14T12:00:00Z')

function session(overrides: Partial<MultiSession>): MultiSession {
  return {
    id: 'sid',
    serverId: 'srv-1',
    status: 'idle',
    ptyAttached: false,
    subStatus: null,
    projectPath: '/home/user/app',
    projectName: 'app',
    lastOutput: '',
    elapsedMs: 0,
    promptCount: 1,
    startedAt: new Date(NOW - 60_000).toISOString(),
    ...overrides,
  }
}

function group(name: string, overrides: Partial<ProjectGroup> = {}): ProjectGroup {
  return {
    projectId: `/home/user/${name}`,
    projectPath: `/home/user/${name}`,
    projectName: name,
    serverId: 'srv-1',
    sessions: [],
    conversationCount: 3,
    latestActivityMs: NOW - 60_000,
    earliestStartMs: 0,
    ...overrides,
  }
}

describe('projectTier', () => {
  it('is active with any live session, whatever its age', () => {
    const live = session({ status: 'running', ptyAttached: true, lifecycle: 'attached' })
    expect(projectTier(group('a', { sessions: [live], latestActivityMs: NOW - 30 * RECENT_WINDOW_MS }), NOW)).toBe('active')
  })

  it('is recent inside the window and quiet past it, held sessions included', () => {
    const held = session({ status: 'waiting_input', ptyAttached: false, lifecycle: 'resumable' })
    expect(projectTier(group('a', { sessions: [held], latestActivityMs: NOW - RECENT_WINDOW_MS + 1 }), NOW)).toBe('recent')
    expect(projectTier(group('a', { latestActivityMs: NOW - RECENT_WINDOW_MS - 1 }), NOW)).toBe('quiet')
  })

  it('keeps each tier in the incoming order', () => {
    const quietOld = group('old', { latestActivityMs: NOW - 40 * 86_400_000 })
    const quietOlder = group('older', { latestActivityMs: NOW - 90 * 86_400_000 })
    const tiers = splitProjectTiers([quietOld, group('fresh'), quietOlder], NOW)
    expect(tiers.recent.map((g) => g.projectName)).toEqual(['fresh'])
    expect(tiers.quiet.map((g) => g.projectName)).toEqual(['old', 'older'])
    expect(tiers.active).toEqual([])
  })
})

describe('projectRailToken', () => {
  it('takes the most urgent live colour and none when nothing is live', () => {
    const waiting = session({ id: 'w', status: 'waiting_input', ptyAttached: true, lifecycle: 'attached' })
    const running = session({ id: 'r', status: 'running', ptyAttached: true, lifecycle: 'attached' })
    const held = session({ id: 'h', status: 'idle', ptyAttached: false, lifecycle: 'resumable' })
    expect(projectRailToken(group('a', { sessions: [running, waiting] }))).toBe('waiting')
    expect(projectRailToken(group('a', { sessions: [running] }))).toBe('running')
    expect(projectRailToken(group('a', { sessions: [held] }))).toBeNull()
  })
})

describe('matchesProjectFilter', () => {
  it('matches name or path, case-insensitively, and everything on a blank query', () => {
    const g = group('tb-mobile', { projectPath: '/Users/me/dev/ai-tools/tb-mobile' })
    expect(matchesProjectFilter(g, '')).toBe(true)
    expect(matchesProjectFilter(g, 'MOBILE')).toBe(true)
    expect(matchesProjectFilter(g, 'ai-tools')).toBe(true)
    expect(matchesProjectFilter(g, 'streamer')).toBe(false)
  })
})
