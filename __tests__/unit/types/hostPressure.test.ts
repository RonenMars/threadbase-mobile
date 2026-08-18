import { isHostPressureLevel, parseHostPressureReasons } from '@/types/api'

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
