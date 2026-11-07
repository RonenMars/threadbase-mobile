import { sessionLastActivityMs } from '@/lib/sessionBoard'
import { formatListTime } from '@/components/sessions/shared/formatListTime'
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

  it('falls back to start plus elapsed for a running session with no lastActivityAt', () => {
    expect(sessionLastActivityMs(session({ status: 'running' }))).toBe(Date.parse('2026-10-10T12:00:00Z') + 5_000)
  })

  it('keeps a resumable session dated by its activity as elapsed time increases', () => {
    const lastActivityAt = '2026-10-10T15:00:00Z'
    const now = Date.parse('2026-10-14T15:00:00Z')
    const resumable = session({ lastActivityAt, elapsedMs: now - Date.parse('2026-10-10T12:00:00Z') })
    const ms = sessionLastActivityMs(resumable)
    expect(ms).toBe(Date.parse(lastActivityAt))
    expect(formatListTime(ms, { now })).not.toBe('now')
    expect(sessionLastActivityMs({ ...resumable, elapsedMs: resumable.elapsedMs + 60_000 })).toBe(ms)
  })

  it('prefers lastActivityAt over completedAt', () => {
    const s = session({ lastActivityAt: '2026-10-10T14:00:00Z', completedAt: '2026-10-10T13:00:00Z' })
    expect(sessionLastActivityMs(s)).toBe(Date.parse('2026-10-10T14:00:00Z'))
  })

  it('sorts an older resumable session behind a recently active one', () => {
    const older = session({ id: 'older', lastActivityAt: '2026-10-10T15:00:00Z', elapsedMs: 4 * 86_400_000 })
    const recent = session({ id: 'recent', lastActivityAt: '2026-10-13T15:00:00Z', elapsedMs: 0 })
    const sorted = [older, recent].sort((a, b) => sessionLastActivityMs(b) - sessionLastActivityMs(a))
    expect(sorted.map((s) => s.id)).toEqual(['recent', 'older'])
  })

  it('degrades a timestamp this build cannot parse to 0', () => {
    expect(sessionLastActivityMs(session({ startedAt: 'not a date' }))).toBe(0)
  })
})
