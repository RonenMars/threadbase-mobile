import {
  hostPressureDetectedReasons,
  hostPressureServerName,
  hostPressureWhyFineReasons,
  primaryHostConstraint,
} from '@/utils/hostPressureCopy'

describe('hostPressureServerName', () => {
  it('prefers the user label over the url', () => {
    expect(hostPressureServerName({ label: 'Studio', url: 'http://192.168.1.10:7070' })).toBe('Studio')
  })

  it('falls back to the url and never invents a host name', () => {
    expect(hostPressureServerName({ url: 'http://192.168.1.10:7070' })).toBe('http://192.168.1.10:7070')
    expect(hostPressureServerName(undefined)).toBeUndefined()
  })
})

describe('primaryHostConstraint', () => {
  it('prefers a resource reason over agents', () => {
    expect(primaryHostConstraint(['memory', 'agents'])).toBe('memory')
  })

  it('returns agents only when that is the story', () => {
    expect(primaryHostConstraint(['agents'])).toBe('agents')
  })
})

describe('host pressure semantics', () => {
  it('trusts streamer order for the first resource reason', () => {
    expect(primaryHostConstraint(['load', 'memory'])).toBe('load')
  })

  it('explains each firing resource and skips agents in whyFine', () => {
    expect(hostPressureDetectedReasons(['memory', 'load', 'agents'])).toEqual([
      'memory',
      'load',
    ])
    expect(hostPressureWhyFineReasons(['memory', 'load', 'agents'])).toEqual([
      'memory',
      'load',
    ])
  })
})
