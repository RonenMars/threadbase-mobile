import {
  CURSOR_CLI_PROVIDER,
  isProviderName,
  providerLabelKey,
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
})
