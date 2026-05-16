import { pathDisplay } from '@/components/sessions/shared/pathDisplay'

describe('pathDisplay', () => {
  describe('empty / null', () => {
    it('returns empty for null', () => {
      expect(pathDisplay(null)).toEqual({ suffix: '', truncated: false })
    })

    it('returns empty for empty string', () => {
      expect(pathDisplay('')).toEqual({ suffix: '', truncated: false })
    })
  })

  describe('mode: last-segment', () => {
    it('returns only the leaf', () => {
      expect(pathDisplay('/Users/ronenmars/Desktop/dev/tb-streamer', { mode: 'last-segment' })).toEqual({
        suffix: 'tb-streamer',
        truncated: false,
      })
    })

    it('handles ~/ prefix', () => {
      expect(pathDisplay('~/code/app', { mode: 'last-segment' })).toEqual({
        suffix: 'app',
        truncated: false,
      })
    })

    it('handles single-segment path', () => {
      expect(pathDisplay('home', { mode: 'last-segment' })).toEqual({
        suffix: 'home',
        truncated: false,
      })
    })
  })

  describe('mode: suffix', () => {
    it('takes last 2 segments by default', () => {
      const r = pathDisplay('/Users/ronenmars/Desktop/dev/ai-tools/tb-streamer', { mode: 'suffix' })
      expect(r.suffix).toBe('ai-tools/tb-streamer')
      expect(r.parent).toBeDefined()
      expect(r.parent).toMatch(/Desktop\/dev$|…\/Desktop\/dev$/)
    })

    it('honours custom suffixSegments', () => {
      const r = pathDisplay('a/b/c/d/e', { mode: 'suffix', suffixSegments: 3 })
      expect(r.suffix).toBe('c/d/e')
      expect(r.parent).toBe('a/b')
    })

    it('drops parent when path is shorter than the requested suffix', () => {
      const r = pathDisplay('a/b', { mode: 'suffix', suffixSegments: 3 })
      expect(r.suffix).toBe('a/b')
      expect(r.parent).toBeUndefined()
    })
  })

  describe('mode: smart — shortest unique trailing suffix', () => {
    it('uses just the last segment when unique', () => {
      const siblings = ['/Users/x/foo', '/Users/x/bar', '/Users/x/baz']
      const r = pathDisplay('/Users/x/foo', { mode: 'smart', siblings })
      expect(r.suffix).toBe('foo')
      expect(r.parent).toBe('Users/x')
    })

    it('walks back when the last segment collides', () => {
      // Both end in "tb-streamer" — need one more segment to disambiguate.
      const siblings = [
        '/Users/ronenmars/Desktop/dev/ai-tools/tb-streamer',
        '/Users/ronenmars/work/archive/tb-streamer',
      ]
      const r = pathDisplay(siblings[0], { mode: 'smart', siblings })
      expect(r.suffix).toBe('ai-tools/tb-streamer')
    })

    it('walks back further when multiple segments collide', () => {
      const siblings = ['a/b/c/leaf', 'x/b/c/leaf']
      const r = pathDisplay(siblings[0], { mode: 'smart', siblings })
      expect(r.suffix).toBe('a/b/c/leaf')
    })

    it('treats empty siblings as unique', () => {
      const r = pathDisplay('/foo/bar', { mode: 'smart' })
      expect(r.suffix).toBe('bar')
      expect(r.parent).toBe('foo')
    })

    it('ignores self when checking collisions', () => {
      const r = pathDisplay('/x/y', { mode: 'smart', siblings: ['/x/y', '/a/b'] })
      expect(r.suffix).toBe('y')
    })
  })

  describe('parent truncation (left-truncate only)', () => {
    it('keeps short parents intact', () => {
      const r = pathDisplay('/foo/bar/baz', { mode: 'smart' })
      expect(r.parent).toBe('foo/bar')
      expect(r.truncated).toBe(false)
    })

    it('left-truncates and prepends …/', () => {
      const r = pathDisplay(
        '/Users/ronenmars/Desktop/dev/ai-tools/tb-streamer',
        { mode: 'smart', parentMaxChars: 18 },
      )
      expect(r.suffix).toBe('tb-streamer')
      expect(r.parent?.startsWith('…/')).toBe(true)
      // rightmost segment "ai-tools" must still be visible — that's the rule.
      expect(r.parent).toMatch(/ai-tools$/)
      expect(r.truncated).toBe(true)
    })

    it('never middle-truncates', () => {
      const r = pathDisplay(
        '/Users/ronenmars/Desktop/dev/ai-tools/tb-streamer',
        { mode: 'smart', parentMaxChars: 18 },
      )
      // Middle-truncation would look like "Users/...tools" with the middle gone.
      // We instead drop leading segments wholesale.
      expect(r.parent).not.toMatch(/\.\.\..*\.\.\./)
    })
  })

  describe('mode: full', () => {
    it('returns suffix + a left-truncated parent', () => {
      const r = pathDisplay(
        '/Users/ronenmars/Desktop/dev/ai-tools/tb-streamer',
        { mode: 'full', parentMaxChars: 20 },
      )
      expect(r.suffix).toBe('tb-streamer')
      expect(r.parent).toBeDefined()
    })

    it('handles ~/ paths', () => {
      const r = pathDisplay('~/code/app', { mode: 'full' })
      expect(r.suffix).toBe('app')
      expect(r.parent).toBe('code')
    })
  })

  describe('edge cases', () => {
    it('does not crash on trailing slash', () => {
      const r = pathDisplay('/Users/foo/', { mode: 'smart' })
      expect(r.suffix).toBe('foo')
    })

    it('does not crash on a single-segment input', () => {
      const r = pathDisplay('foo', { mode: 'smart' })
      expect(r.suffix).toBe('foo')
      expect(r.parent).toBeUndefined()
    })

    it('strips the leading slash of an absolute path', () => {
      const r = pathDisplay('/a/b', { mode: 'smart' })
      expect(r.suffix).toBe('b')
      expect(r.parent).toBe('a')
    })
  })
})
