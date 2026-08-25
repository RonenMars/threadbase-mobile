import i18n from '@/test-utils/i18n-setup'
import {
  getHostPressureBannerLabel,
  getHostPressureDetectedLabel,
  getHostPressureWhatToDoLabel,
  getHostPressureWhyFineLabel,
} from '@/components/servers/hostPressureLabels'

describe('host-pressure labels', () => {
  const t = i18n.getFixedT('en', 'servers')

  it('translates semantic pressure levels and constraints', () => {
    expect(getHostPressureBannerLabel('elevated', 'memory', 'Studio', t)).toBe(
      'Studio is under memory pressure.',
    )
    expect(getHostPressureBannerLabel('critical', 'load', 'Studio', t)).toBe(
      'Studio is running at full load.',
    )
    expect(getHostPressureBannerLabel('elevated', undefined, 'Studio', t)).toBe(
      'Studio is under pressure.',
    )
  })

  it('translates every resource reason in both explanation contexts', () => {
    expect(getHostPressureDetectedLabel('memory', t)).toBe('The computer is low on free RAM.')
    expect(getHostPressureDetectedLabel('event_loop', t)).toContain('Threadbase server')
    expect(getHostPressureDetectedLabel('load', t)).toBe('The CPU is busy.')
    expect(getHostPressureWhyFineLabel('memory', t)).toContain('swap RAM to disk')
    expect(getHostPressureWhyFineLabel('event_loop', t)).toContain('New ones wait')
    expect(getHostPressureWhyFineLabel('load', t)).toContain('Background compiles')
  })

  it('translates OS-specific and generic advice', () => {
    expect(getHostPressureWhatToDoLabel('darwin', t)).toContain('On this Mac')
    expect(getHostPressureWhatToDoLabel('linux', t)).toContain('On this Linux machine')
    expect(getHostPressureWhatToDoLabel('win32', t)).toContain('On this Windows PC')
    expect(getHostPressureWhatToDoLabel(undefined, t)).toContain('On the computer')
  })
})
