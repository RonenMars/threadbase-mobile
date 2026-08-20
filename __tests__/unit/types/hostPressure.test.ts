import { isHostPressureLevel, parseHostPressureOs, parseHostPressureReasons } from '@/types/api'

describe('parseHostPressureReasons', () => {
  it('keeps known reasons in order and drops unknown strings', () => {
    expect(parseHostPressureReasons(['memory', 'disk', 'load', 'cpu', 'agents'])).toEqual([
      'memory',
      'load',
      'agents',
    ])
  })

  it('returns an empty list when nothing matches', () => {
    expect(parseHostPressureReasons(['disk', 'cpu'])).toEqual([])
  })
})

describe('parseHostPressureOs', () => {
  it('accepts Node platform strings', () => {
    expect(parseHostPressureOs('darwin')).toBe('darwin')
    expect(parseHostPressureOs('linux')).toBe('linux')
    expect(parseHostPressureOs('win32')).toBe('win32')
  })

  it('accepts common aliases from GET /api/info leftovers', () => {
    expect(parseHostPressureOs('macOS')).toBe('darwin')
    expect(parseHostPressureOs('Windows')).toBe('win32')
  })

  it('drops unknown values', () => {
    expect(parseHostPressureOs('freebsd')).toBeUndefined()
    expect(parseHostPressureOs(undefined)).toBeUndefined()
  })
})

describe('isHostPressureLevel', () => {
  it('accepts elevated and critical', () => {
    expect(isHostPressureLevel('elevated')).toBe(true)
    expect(isHostPressureLevel('critical')).toBe(true)
  })

  it('rejects other strings', () => {
    expect(isHostPressureLevel('ok')).toBe(false)
    expect(isHostPressureLevel('warning')).toBe(false)
  })
})
