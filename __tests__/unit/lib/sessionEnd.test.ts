import { supportsSessionEndActions } from '@/lib/sessionEnd'

describe('supportsSessionEndActions', () => {
  it.each([
    ['1.96.0', true],
    ['1.96.3', true],
    ['1.100.0', true],
    ['2.0.0', true],
    ['1.96.0-beta.1', true],
    ['1.95.9', false],
    ['1.9.99', false],
    ['0.0.0-mock', false],
    ['', false],
    [undefined, false],
    [null, false],
    ['garbage', false],
  ])('%s → %s', (version, expected) => {
    expect(supportsSessionEndActions(version)).toBe(expected)
  })
})
