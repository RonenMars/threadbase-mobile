import {
  parseProvidersResponse,
  findProviderHealth,
  GENERIC_TERMINAL_CAPABILITIES,
} from '@/types/provider-health'

describe('parseProvidersResponse', () => {
  const valid = {
    providers: [
      {
        name: 'claude-code',
        available: true,
        version: '2.1.214',
        verifiedAgainst: { captured: ['2.1.214'], min: '2.1.0' },
        capabilities: {
          freshSessionId: 'explicit',
          resume: 'native',
          systemPrompt: 'flag',
          structuredQuestions: true,
          permissionGates: true,
          liveControl: true,
        },
        warnings: [],
      },
      {
        name: 'codex-cli',
        available: false,
        version: null,
        verifiedAgainst: { captured: ['0.140.0-alpha.19'], min: '0.140.0' },
        capabilities: {
          freshSessionId: 'late-bound',
          resume: 'native',
          systemPrompt: 'positional',
          structuredQuestions: false,
          permissionGates: true,
          liveControl: true,
        },
        warnings: [
          {
            code: 'provider_not_found',
            message: 'codex-cli could not be located.',
          },
        ],
      },
    ],
  }

  it('parses the providers envelope', () => {
    const parsed = parseProvidersResponse(valid)
    expect(parsed?.providers).toHaveLength(2)
    expect(findProviderHealth(parsed?.providers, 'codex-cli')?.available).toBe(false)
    expect(findProviderHealth(parsed?.providers, 'codex-cli')?.warnings[0].code).toBe(
      'provider_not_found',
    )
  })

  it('rejects unknown provider names', () => {
    const parsed = parseProvidersResponse({
      providers: [{ ...valid.providers[0], name: 'mystery-cli' }],
    })
    expect(parsed?.providers).toHaveLength(0)
  })

  it('exports generic-terminal fallback capabilities', () => {
    expect(GENERIC_TERMINAL_CAPABILITIES.structuredQuestions).toBe(false)
    expect(GENERIC_TERMINAL_CAPABILITIES.resume).toBe('unsupported')
  })
})
