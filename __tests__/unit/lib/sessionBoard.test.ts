import { sessionLastActivityMs } from '@/lib/sessionBoard'
import type { MultiSession } from '@/types/api'

const session = (overrides: Partial<MultiSession>): MultiSession => ({
  id: 'sid',
  serverId: 'server-1',
  status: 'idle',
  ptyAttached: false,
  subStatus: null,
  projectPath: '/home/user/tb-mobile',
  projectName: 'tb-mobile',
  lastOutput: '',
  elapsedMs: 5_000,
  promptCount: 1,
  startedAt: '2026-10-10T12:00:00Z',
  ...overrides,
})

describe('sessionLastActivityMs', () => {
  it('uses completedAt when the session finished', () => {
    expect(sessionLastActivityMs(session({ completedAt: '2026-10-10T13:00:00Z' }))).toBe(Date.parse('2026-10-10T13:00:00Z'))
  })

  it('adds the elapsed time to the start of a session still open', () => {
    expect(sessionLastActivityMs(session({}))).toBe(Date.parse('2026-10-10T12:00:00Z') + 5_000)
  })

  it('degrades a timestamp this build cannot parse to 0', () => {
    expect(sessionLastActivityMs(session({ startedAt: 'not a date' }))).toBe(0)
  })
})
