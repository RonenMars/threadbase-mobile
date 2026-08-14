import {
  deriveConversationPresentation,
  deriveSessionPresentation,
  sessionOpensAsHistory,
  sessionPhase,
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

  it('prefers lifecycle completed/failed over status idle', () => {
    expect(
      deriveSessionPresentation(
        base({ status: 'idle', ptyAttached: false, lifecycle: 'completed' }),
      ),
    ).toMatchObject({ kind: 'completed', live: false })
    expect(
      deriveSessionPresentation(
        base({
          status: 'idle',
          ptyAttached: false,
          lifecycle: 'failed',
          failureReason: 'boom',
        }),
      ).labelKey,
    ).toBe('status.failed')
  })

  it('treats lifecycle resumable as historical (resume, observe-only)', () => {
    expect(
      deriveSessionPresentation(
        base({ status: 'idle', ptyAttached: false, lifecycle: 'resumable' }),
      ),
    ).toMatchObject({
      kind: 'historical',
      live: false,
      capabilities: { canResume: true, isObserveOnly: true },
    })
  })
})

describe('sessionPhase', () => {
  it('reads an idle, detached session with no lifecycle as starting, not ended', () => {
    expect(sessionPhase({ status: 'idle', ptyAttached: false })).toBe('starting')
  })

  it('does not treat completedAt alone as ended (holds stamp it too)', () => {
    expect(
      sessionPhase({ status: 'idle', ptyAttached: false, completedAt: '2026-08-01T00:00:00Z' }),
    ).toBe('starting')
  })

  it('reads an idle, attached session as live', () => {
    expect(sessionPhase({ status: 'idle', ptyAttached: true })).toBe('live')
  })

  it('reads a running, detached session as live', () => {
    expect(sessionPhase({ status: 'running', ptyAttached: false })).toBe('live')
  })

  it('reads a running, attached session as live', () => {
    expect(sessionPhase({ status: 'running', ptyAttached: true })).toBe('live')
  })

  it('maps streamer lifecycle onto the coarse phase', () => {
    expect(sessionPhase({ status: 'running', ptyAttached: true, lifecycle: 'attached' })).toBe(
      'live',
    )
    expect(sessionPhase({ status: 'idle', ptyAttached: false, lifecycle: 'resumable' })).toBe(
      'resumable',
    )
    expect(sessionPhase({ status: 'idle', ptyAttached: false, lifecycle: 'completed' })).toBe(
      'ended',
    )
    expect(sessionPhase({ status: 'idle', ptyAttached: false, lifecycle: 'failed' })).toBe(
      'ended',
    )
  })

  it('gives lifecycle precedence over a stale ptyAttached: true', () => {
    expect(
      sessionPhase({ status: 'idle', ptyAttached: true, lifecycle: 'completed' }),
    ).toBe('ended')
  })
})

describe('sessionOpensAsHistory', () => {
  it('opens history for ended and resumable lifecycles', () => {
    expect(
      sessionOpensAsHistory({ status: 'idle', ptyAttached: false, lifecycle: 'completed' }),
    ).toBe(true)
    expect(
      sessionOpensAsHistory({ status: 'idle', ptyAttached: false, lifecycle: 'resumable' }),
    ).toBe(true)
    expect(
      sessionOpensAsHistory({ status: 'running', ptyAttached: true, lifecycle: 'attached' }),
    ).toBe(false)
  })

  it('falls back to idle+detached when lifecycle is absent', () => {
    expect(sessionOpensAsHistory({ status: 'idle', ptyAttached: false })).toBe(true)
    expect(sessionOpensAsHistory({ status: 'running', ptyAttached: false })).toBe(false)
  })
})

describe('deriveSessionPresentation subStatus', () => {
  it('passes the phase through for a managed live session', () => {
    expect(
      deriveSessionPresentation(base({ status: 'running', subStatus: 'working' })).subStatus,
    ).toBe('working')
  })

  // The gate is `presentation.live`, not raw `status`. An external session is
  // classified off ownership + processLiveness and never consults `status`, so a
  // raw-status gate would render a phase beside a badge reading "External".
  it('drops the phase for a session that is running but presents as external', () => {
    const presentation = deriveSessionPresentation(
      base({
        status: 'running',
        ownership: 'external',
        processLiveness: 'gone',
        subStatus: 'working',
      }),
    )
    expect(presentation.kind).toBe('stale')
    expect(presentation.subStatus).toBeNull()
  })

  it('drops the phase on an idle session', () => {
    expect(
      deriveSessionPresentation(base({ status: 'idle', subStatus: 'working' })).subStatus,
    ).toBeNull()
  })

  // A newer server may emit a phase this build does not know. Treat it as no
  // phase rather than rendering a raw wire value.
  it('treats an unrecognised phase as no phase', () => {
    expect(
      deriveSessionPresentation(
        base({ status: 'running', subStatus: 'compacting' as 'working' }),
      ).subStatus,
    ).toBeNull()
  })

  it('is null when the server omits the field entirely', () => {
    expect(deriveSessionPresentation(base({ status: 'running' })).subStatus).toBeNull()
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
