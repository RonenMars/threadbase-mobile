import { dominantProvider, showsProviderMark } from '@/lib/providerDominance'

describe('dominantProvider', () => {
  it('returns undefined for an empty list', () => {
    expect(dominantProvider([])).toBeUndefined()
  })

  it('returns the only provider', () => {
    expect(dominantProvider(['claude-code'])).toBe('claude-code')
  })

  it('returns the clear majority', () => {
    expect(
      dominantProvider(['codex-cli', 'claude-code', 'codex-cli', 'cursor']),
    ).toBe('codex-cli')
  })

  it('returns undefined on an exact tie at the top', () => {
    expect(
      dominantProvider(['claude-code', 'codex-cli', 'cursor', 'codex-cli', 'claude-code']),
    ).toBeUndefined()
  })

  it('ignores undefined rows', () => {
    expect(
      dominantProvider([undefined, 'cursor', undefined, undefined]),
    ).toBe('cursor')
    expect(dominantProvider([undefined, undefined])).toBeUndefined()
  })
})

describe('showsProviderMark', () => {
  it('shows only when the row provider differs from a defined dominant', () => {
    expect(showsProviderMark('codex-cli', 'claude-code')).toBe(true)
    expect(showsProviderMark('claude-code', 'claude-code')).toBe(false)
    expect(showsProviderMark(undefined, 'claude-code')).toBe(false)
    expect(showsProviderMark('codex-cli', undefined)).toBe(false)
  })
})
