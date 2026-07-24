import { parsePushHealthResponse } from '@/types/push-health'
import { formatEpoch } from '@/services/push-health'

describe('parsePushHealthResponse', () => {
  it('parses available health with tokens', () => {
    const parsed = parsePushHealthResponse({
      available: true,
      tokens: [
        {
          platform: 'ios',
          deviceId: 'dev-1',
          registeredAt: 1_700_000_000_000,
          lastSuccessAt: null,
          lastFailureAt: null,
          lastFailureCode: null,
          failureStreak: 0,
          revokedAt: null,
          state: 'never-delivered',
        },
      ],
    })
    expect(parsed?.available).toBe(true)
    expect(parsed?.tokens[0].state).toBe('never-delivered')
  })

  it('rejects missing available flag', () => {
    expect(parsePushHealthResponse({ tokens: [] })).toBeNull()
  })
})

describe('formatEpoch', () => {
  it('formats numbers and null', () => {
    expect(formatEpoch(null)).toBe('—')
    expect(formatEpoch(1_700_000_000_000)).toContain('2023')
  })
})
