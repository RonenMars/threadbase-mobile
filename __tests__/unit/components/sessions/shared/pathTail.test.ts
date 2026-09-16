import { basename, pathSegments, shortPath } from '@/components/sessions/shared/pathTail'

describe('pathSegments', () => {
  it('returns empty for null, undefined, and empty', () => {
    expect(pathSegments(null)).toEqual([])
    expect(pathSegments(undefined)).toEqual([])
    expect(pathSegments('')).toEqual([])
  })

  it('drops empty segments from slashes', () => {
    expect(pathSegments('/Users/me/tb-mobile/')).toEqual(['Users', 'me', 'tb-mobile'])
  })
})

describe('basename', () => {
  it('returns the last segment', () => {
    expect(basename('/Users/me/dev/tb-mobile')).toBe('tb-mobile')
  })

  it('treats a null path as missing', () => {
    expect(basename(null)).toBeUndefined()
    expect(basename(undefined)).toBeUndefined()
    expect(basename('')).toBeUndefined()
  })
})

describe('shortPath', () => {
  it('joins the last two segments', () => {
    expect(shortPath('/Users/me/dev/ai-tools/tb-mobile')).toBe('ai-tools/tb-mobile')
  })

  it('returns the whole path when it is shorter than the count', () => {
    expect(shortPath('tb-mobile')).toBe('tb-mobile')
  })

  it('returns empty when the path is missing', () => {
    expect(shortPath(null)).toBe('')
    expect(shortPath(undefined)).toBe('')
  })
})
