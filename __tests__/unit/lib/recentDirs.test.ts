import { mergeRecentDirs, parseRecentDirs } from '@/lib/recentDirs'

const T1 = '2026-10-01T10:00:00.000Z'
const T2 = '2026-10-02T10:00:00.000Z'
const T3 = '2026-10-03T10:00:00.000Z'

describe('parseRecentDirs', () => {
  it('names each directory and skips rows it cannot read', () => {
    expect(
      parseRecentDirs({
        dirs: [{ path: '/Users/me/dev/tb-mobile', lastUsedAt: T1 }, { lastUsedAt: T2 }, { path: '  ' }],
      }),
    ).toEqual([{ path: '/Users/me/dev/tb-mobile', name: 'tb-mobile', lastUsedAt: T1 }])
  })

  it('reads a missing body as empty', () => {
    expect(parseRecentDirs(null)).toEqual([])
    expect(parseRecentDirs({})).toEqual([])
  })
})

describe('mergeRecentDirs', () => {
  const recorded = parseRecentDirs({
    dirs: [
      { path: '/old', lastUsedAt: T1 },
      { path: '/repo', lastUsedAt: T2 },
    ],
  })

  it('keeps recorded directories that no live session mentions', () => {
    expect(mergeRecentDirs(recorded, [], 'srv', 8).map((d) => d.path)).toEqual(['/repo', '/old'])
  })

  it('lets a newer session move its directory up, once per path', () => {
    const sessions = [
      { serverId: 'srv', projectPath: '/old/', startedAt: T3 },
      { serverId: 'srv', projectPath: '/repo', startedAt: T1 },
      { serverId: 'other', projectPath: '/elsewhere', startedAt: T3 },
    ]
    expect(mergeRecentDirs(recorded, sessions, 'srv', 8)).toEqual([
      { path: '/old', name: 'old', lastUsedAt: T3 },
      { path: '/repo', name: 'repo', lastUsedAt: T2 },
    ])
  })

  it('falls back to live sessions alone and caps the list', () => {
    const sessions = [
      { serverId: 'srv', projectPath: '/a', startedAt: T1 },
      { serverId: 'srv', projectPath: '/b', startedAt: T2 },
      { serverId: 'srv', projectPath: null, startedAt: T3 },
    ]
    expect(mergeRecentDirs([], sessions, 'srv', 1).map((d) => d.path)).toEqual(['/b'])
  })
})
