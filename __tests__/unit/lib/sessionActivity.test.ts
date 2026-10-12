import { sessionActivityMs } from '@/lib/sessionActivity'
import type { MultiSession } from '@/types/api'

const STARTED = Date.parse('2026-09-21T13:31:00Z')
const LAST = Date.parse('2026-09-21T13:40:00Z')
// What a server counting elapsedMs up to the request time sends a week later.
const ELAPSED_TO_NOW = 7 * 24 * 60 * 60 * 1000

function session(overrides: Partial<MultiSession>): MultiSession {
  return {
    id: 'sid',
    serverId: 'srv-1',
    status: 'idle',
    ptyAttached: false,
    subStatus: null,
    projectPath: 'C:\\Users\\PC\\Desktop\\dev\\cemento',
    projectName: 'cemento',
    lastOutput: '',
    elapsedMs: ELAPSED_TO_NOW,
    promptCount: 3,
    startedAt: new Date(STARTED).toISOString(),
    ...overrides,
  }
}

describe('sessionActivityMs', () => {
  it('uses lastActivityAt for a resumable session with no completedAt', () => {
    const s = session({ lifecycle: 'resumable', ownership: 'historical', lastActivityAt: new Date(LAST).toISOString() })
    expect(sessionActivityMs(s)).toBe(LAST)
  })

  it('falls back to startedAt for a resumable session without lastActivityAt', () => {
    expect(sessionActivityMs(session({ lifecycle: 'resumable', ownership: 'historical' }))).toBe(STARTED)
  })

  it('counts elapsedMs for a live session', () => {
    const live = session({ status: 'running', ptyAttached: true, lifecycle: 'attached', elapsedMs: 5_000 })
    expect(sessionActivityMs(live)).toBe(STARTED + 5_000)
  })

  it('prefers completedAt when the server stamped one', () => {
    const done = session({ lifecycle: 'completed', completedAt: new Date(LAST).toISOString() })
    expect(sessionActivityMs(done)).toBe(LAST)
  })

  it('degrades an unparseable timestamp to 0', () => {
    expect(sessionActivityMs(session({ lifecycle: 'resumable', startedAt: 'not-a-date' }))).toBe(0)
  })
})
