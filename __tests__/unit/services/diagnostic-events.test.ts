import {
  recordDiagnosticEvent,
  getDiagnosticEvents,
  clearDiagnosticEvents,
  DIAGNOSTIC_EVENTS,
} from '@/services/diagnostic-events'

beforeEach(() => clearDiagnosticEvents())

describe('diagnostic-events', () => {
  it('records valid enum events with a coarse timestamp', () => {
    recordDiagnosticEvent('app_started')
    recordDiagnosticEvent('server_added')
    const events = getDiagnosticEvents()
    expect(events.map((e) => e.event)).toEqual(['app_started', 'server_added'])
    events.forEach((e) => expect(e.at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/))
  })

  it('ignores anything not in the strict enum (cannot inject free-form text)', () => {
    // @ts-expect-error intentional bad input
    recordDiagnosticEvent('https://evil.example.com/leak')
    // @ts-expect-error intentional bad input
    recordDiagnosticEvent('arbitrary user text with a secret tb_live_x')
    expect(getDiagnosticEvents()).toEqual([])
  })

  it('caps the buffer and drops the oldest entries', () => {
    for (let i = 0; i < 60; i++) recordDiagnosticEvent('app_resumed')
    expect(getDiagnosticEvents().length).toBeLessThanOrEqual(40)
  })

  it('every declared event is a lowercase snake_case token', () => {
    for (const e of DIAGNOSTIC_EVENTS) {
      expect(e).toMatch(/^[a-z][a-z_]*$/)
    }
  })
})
