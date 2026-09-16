import {
  CURSOR_CLI_PROVIDER,
  isProviderName,
  providerColor,
  providerLabelKey,
  PROVIDER_COLOR,
} from '@/constants/providers'

describe('provider helpers', () => {
  it('accepts cursor-cli as a provider name', () => {
    expect(isProviderName(CURSOR_CLI_PROVIDER)).toBe(true)
    expect(isProviderName('mystery-cli')).toBe(false)
  })

  it('maps cursor-cli to the cursor label key', () => {
    expect(providerLabelKey(CURSOR_CLI_PROVIDER)).toBe('cursor')
    expect(providerLabelKey('codex-cli')).toBe('codex')
    expect(providerLabelKey(undefined)).toBe('claude')
  })

  it('resolves every provider through PROVIDER_COLOR', () => {
    expect(providerColor('claude-code')).toBe(PROVIDER_COLOR.claude)
    expect(providerColor('codex-cli')).toBe(PROVIDER_COLOR.codex)
    expect(providerColor(CURSOR_CLI_PROVIDER)).toBe(PROVIDER_COLOR.cursor)
    expect(providerColor(undefined)).toBe(PROVIDER_COLOR.claude)
  })
})
