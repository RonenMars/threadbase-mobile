import {
  MAX_ADDITIONAL_PATHS,
  addAdditionalPath,
  additionalPathsForStart,
  canAddAdditionalPath,
  encodeAdditionalPathsParam,
  parseAdditionalPathsParam,
  sessionAdditionalPaths,
} from '@/lib/additionalPaths'

describe('additionalPaths', () => {
  it('adds a folder once, and not past the cap', () => {
    expect(addAdditionalPath(['a'], 'b')).toEqual(['a', 'b'])
    expect(addAdditionalPath(['a'], 'a')).toEqual(['a'])
    const full = Array.from({ length: MAX_ADDITIONAL_PATHS }, (_, i) => `d${i}`)
    expect(addAdditionalPath(full, 'x')).toEqual(full)
    expect(canAddAdditionalPath(full, 'x')).toBe(false)
    expect(canAddAdditionalPath(['a'], 'a')).toBe(false)
    expect(canAddAdditionalPath(['a'], 'b')).toBe(true)
  })

  it('drops entries the primary or another entry covers, keeping order', () => {
    expect(
      additionalPathsForStart('app', ['lib', 'app', 'app/src', 'lib/sub', 'docs', 'app-old']),
    ).toEqual(['lib', 'docs', 'app-old'])
    expect(additionalPathsForStart('app', ['lib/sub', 'lib'])).toEqual(['lib'])
  })

  it('drops everything when the session starts at the browse root', () => {
    expect(additionalPathsForStart('', ['lib', 'docs'])).toEqual([])
  })

  it('round-trips the URL param and reads anything malformed as none', () => {
    expect(encodeAdditionalPathsParam([])).toBeUndefined()
    expect(parseAdditionalPathsParam(encodeAdditionalPathsParam(['lib', 'docs']))).toEqual([
      'lib',
      'docs',
    ])
    expect(parseAdditionalPathsParam(undefined)).toEqual([])
    expect(parseAdditionalPathsParam('not json')).toEqual([])
    expect(parseAdditionalPathsParam('{"a":1}')).toEqual([])
    expect(parseAdditionalPathsParam('["lib", 3, ""]')).toEqual(['lib'])
  })

  it('reads a server field defensively', () => {
    expect(sessionAdditionalPaths(undefined)).toEqual([])
    expect(sessionAdditionalPaths(null)).toEqual([])
    expect(sessionAdditionalPaths(['/w/lib', ''])).toEqual(['/w/lib'])
  })
})
