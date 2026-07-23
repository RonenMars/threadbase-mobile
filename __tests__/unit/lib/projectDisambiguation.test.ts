import {
  collidingProjectPaths,
  shouldForceServerChip,
} from '@/lib/projectDisambiguation'

describe('projectDisambiguation', () => {
  it('flags paths that appear on more than one server', () => {
    const colliding = collidingProjectPaths([
      { projectPath: '/home/a/proj', serverId: 's1' },
      { projectPath: '/home/a/proj', serverId: 's2' },
      { projectPath: '/home/a/other', serverId: 's1' },
      { projectPath: '  /home/a/proj  ', serverId: 's1' },
    ])
    expect([...colliding]).toEqual(['/home/a/proj'])
  })

  it('ignores blank paths and single-server duplicates', () => {
    expect(
      collidingProjectPaths([
        { projectPath: '', serverId: 's1' },
        { projectPath: null, serverId: 's2' },
        { projectPath: '/solo', serverId: 's1' },
        { projectPath: '/solo', serverId: 's1' },
      ]).size,
    ).toBe(0)
  })

  it('shouldForceServerChip only for colliding paths', () => {
    const colliding = new Set(['/shared'])
    expect(shouldForceServerChip('/shared', colliding)).toBe(true)
    expect(shouldForceServerChip('/other', colliding)).toBe(false)
    expect(shouldForceServerChip(undefined, colliding)).toBe(false)
  })
})
