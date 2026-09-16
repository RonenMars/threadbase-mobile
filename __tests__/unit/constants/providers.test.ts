import {
  CURSOR_PROVIDER,
  isProviderName,
  providerColor,
  providerLabelKey,
  PROVIDER_COLOR,
} from '@/constants/providers'

describe('provider helpers', () => {
  it('accepts cursor and the legacy cursor-cli alias', () => {
    expect(isProviderName(CURSOR_PROVIDER)).toBe(true)
    expect(isProviderName('cursor-cli')).toBe(true)
    expect(isProviderName('mystery-cli')).toBe(false)
  })

  it('maps cursor and cursor-cli to the cursor label key', () => {
    expect(providerLabelKey(CURSOR_PROVIDER)).toBe('cursor')
    expect(providerLabelKey('cursor-cli')).toBe('cursor')
    expect(providerLabelKey('codex-cli')).toBe('codex')
    expect(providerLabelKey(undefined)).toBe('claude')
  })

  it('resolves every provider through PROVIDER_COLOR', () => {
    expect(providerColor('claude-code')).toBe(PROVIDER_COLOR.claude)
    expect(providerColor('codex-cli')).toBe(PROVIDER_COLOR.codex)
    expect(providerColor(CURSOR_PROVIDER)).toBe(PROVIDER_COLOR.cursor)
    expect(providerColor(undefined)).toBe(PROVIDER_COLOR.claude)
  })
})
