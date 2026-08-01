import {
  deriveConversationPresentation,
  deriveSessionPresentation,
} from '@/lib/sessionPresentation'

function base(
  overrides: Partial<Parameters<typeof deriveSessionPresentation>[0]> & { status: string },
) {
  return {
    ptyAttached: true,
    ownership: 'managed' as const,
    ...overrides,
  }
}

describe('deriveSessionPresentation', () => {
  it('marks managed running / waiting as live with control', () => {
    expect(deriveSessionPresentation(base({ status: 'running' }))).toMatchObject({
      kind: 'managed_live',
      live: true,
      capabilities: { canSendInput: true, canCancel: true, isObserveOnly: false },
    })
    expect(deriveSessionPresentation(base({ status: 'waiting_input' })).labelKey).toBe(
      'status.waiting',
    )
  })

  it('marks resumed live sessions distinctly', () => {
    expect(
      deriveSessionPresentation(
        base({ status: 'running', resumedFromConversationId: 'c1' }),
      ),
    ).toMatchObject({
      kind: 'resumed',
      live: true,
      capabilities: { canSendInput: true },
    })
  })

  it('marks external alive as observe-only live', () => {
    expect(
      deriveSessionPresentation(
        base({
          status: 'idle',
          ownership: 'external',
          processLiveness: 'alive',
          ptyAttached: false,
        }),
      ),
    ).toMatchObject({
      kind: 'external_live',
      live: true,
      externalLive: true,
      capabilities: { isObserveOnly: true, canCancel: false },
    })
  })

  it('marks on_hold and completed/failed from runtime status strings', () => {
    expect(deriveSessionPresentation(base({ status: 'on_hold' })).kind).toBe('on_hold')
    expect(deriveSessionPresentation(base({ status: 'completed' })).kind).toBe('completed')
    expect(deriveSessionPresentation(base({ status: 'failed' })).labelKey).toBe('status.failed')
  })

  it('marks gone external processes as stale', () => {
    expect(
      deriveSessionPresentation(
        base({
          status: 'idle',
          ownership: 'external',
          processLiveness: 'gone',
          ptyAttached: false,
        }),
      ).kind,
    ).toBe('stale')
  })

  it('marks historical ownership as resumable history', () => {
    expect(
      deriveSessionPresentation(
        base({
          status: 'idle',
          ownership: 'historical',
          ptyAttached: false,
        }),
      ),
    ).toMatchObject({
      kind: 'historical',
      labelKey: 'status.historical',
      capabilities: { canResume: true, isObserveOnly: true },
    })
  })

  it('labels an interrupted historical session by what it was doing', () => {
    const historical = { status: 'idle', ownership: 'historical' as const, ptyAttached: false }
    expect(
      deriveSessionPresentation(base({ ...historical, interruptedStatus: 'running' })).labelKey,
    ).toBe('status.interrupted')
    expect(
      deriveSessionPresentation(base({ ...historical, interruptedStatus: 'waiting_input' }))
        .labelKey,
    ).toBe('status.interruptedWaiting')
  })

  it('keeps an interrupted session idle, resumable and grey', () => {
    expect(
      deriveSessionPresentation(
        base({
          status: 'idle',
          ownership: 'historical',
          ptyAttached: false,
          interruptedStatus: 'running',
        }),
      ),
    ).toMatchObject({
      kind: 'historical',
      live: false,
      externalLive: false,
      colorToken: 'idle',
      capabilities: { canResume: true, canSendInput: false, isObserveOnly: true },
    })
  })
})

describe('deriveConversationPresentation', () => {
  it('returns unavailable when resume is blocked', () => {
    expect(
      deriveConversationPresentation({
        resumable: false,
        unavailableReason: 'path_missing',
      }),
    ).toMatchObject({
      kind: 'unavailable',
      labelKey: 'status.unavailablePath',
      capabilities: { canResume: false },
    })
  })

  it('returns null when conversation is resumable', () => {
    expect(deriveConversationPresentation({ resumable: true })).toBeNull()
  })
})
