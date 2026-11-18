import { findPinnedDir, parsePinnedDirs } from '@/lib/pinnedDirs'

describe('parsePinnedDirs', () => {
  it('keeps well-formed rows, canonicalizes paths, and skips the rest', () => {
    expect(
      parsePinnedDirs({
        dirs: [
          { path: '/root/proj/', relativePath: 'proj' },
          { path: '/root', relativePath: '' },
          { path: '/gone' },
          { path: '   ' },
          {} as never,
        ],
      }),
    ).toEqual([
      { path: '/root/proj', name: 'proj', relativePath: 'proj' },
      { path: '/root', name: 'root', relativePath: '' },
      { path: '/gone', name: 'gone', relativePath: null },
    ])
  })

  it('reads a missing or malformed body as no pins', () => {
    expect(parsePinnedDirs(undefined)).toEqual([])
    expect(parsePinnedDirs({ dirs: 'nope' as never })).toEqual([])
  })
})

describe('findPinnedDir', () => {
  const dirs = parsePinnedDirs({
    dirs: [
      { path: '/root', relativePath: '' },
      { path: '/root/proj', relativePath: 'proj' },
    ],
  })

  it('matches the browse-relative path, the root included', () => {
    expect(findPinnedDir(dirs, 'proj')?.path).toBe('/root/proj')
    expect(findPinnedDir(dirs, '')?.path).toBe('/root')
  })

  it('matches an absolute prefill path', () => {
    expect(findPinnedDir(dirs, '/root/proj/')?.path).toBe('/root/proj')
  })

  it('finds nothing for an unpinned folder', () => {
    expect(findPinnedDir(dirs, 'proj/sub')).toBeUndefined()
  })
})
