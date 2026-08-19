import {
  hostPressureBannerKey,
  hostPressureDetectedKeys,
  hostPressureServerName,
  hostPressureWhatToDoKey,
  hostPressureWhyFineKeys,
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

describe('hostPressureBannerKey', () => {
  it('names memory in the headline', () => {
    expect(hostPressureBannerKey('elevated', ['memory'])).toBe(
      'hostPressure.banner.memoryElevated',
    )
    expect(hostPressureBannerKey('critical', ['memory'])).toBe(
      'hostPressure.banner.memoryCritical',
    )
  })

  it('does not pick agents when a resource also fired', () => {
    expect(hostPressureBannerKey('elevated', ['load', 'agents'])).toBe(
      'hostPressure.banner.loadElevated',
    )
  })

  it('trusts streamer order for the first resource reason', () => {
    expect(primaryHostConstraint(['load', 'memory'])).toBe('load')
  })

  it('falls back when reasons were all unknown', () => {
    expect(hostPressureBannerKey('elevated', [])).toBe('hostPressure.banner.fallbackElevated')
    expect(hostPressureBannerKey('critical', [])).toBe('hostPressure.banner.fallbackCritical')
  })
})

describe('hostPressure modal keys', () => {
  it('explains each firing resource and skips agents in whyFine', () => {
    expect(hostPressureDetectedKeys(['memory', 'load', 'agents'])).toEqual([
      'hostPressure.detected.memory',
      'hostPressure.detected.load',
    ])
    expect(hostPressureWhyFineKeys(['memory', 'load', 'agents'])).toEqual([
      'hostPressure.whyFine.memory',
      'hostPressure.whyFine.load',
    ])
  })

  it('picks OS-specific advice', () => {
    expect(hostPressureWhatToDoKey('darwin')).toBe('hostPressure.whatToDo.darwin')
    expect(hostPressureWhatToDoKey('win32')).toBe('hostPressure.whatToDo.win32')
    expect(hostPressureWhatToDoKey(undefined)).toBe('hostPressure.whatToDo.generic')
  })
})
