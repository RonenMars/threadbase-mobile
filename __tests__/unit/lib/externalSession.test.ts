import { isExternalSession, isExternalAlive } from '@/lib/externalSession'
import type { Session } from '@/types/api'

describe('isExternalSession', () => {
  it('is true only for ownership "external"', () => {
    expect(isExternalSession({ ownership: 'external' })).toBe(true)
    expect(isExternalSession({ ownership: 'managed' })).toBe(false)
    expect(isExternalSession({ ownership: 'historical' })).toBe(false)
  })

  it('is false when ownership is omitted (older server)', () => {
    expect(isExternalSession({ ownership: undefined })).toBe(false)
  })
})

describe('isExternalAlive', () => {
  it('trusts processLiveness when present', () => {
    expect(isExternalAlive({ processLiveness: 'alive' })).toBe(true)
    expect(isExternalAlive({ processLiveness: 'gone' })).toBe(false)
  })

  it('treats an active_writing JSONL as alive', () => {
    expect(
      isExternalAlive({ activity: { state: 'active_writing', lastEventAt: 'x', source: 'jsonl' } }),
    ).toBe(true)
  })

  it('does not treat a quiet JSONL as alive', () => {
    expect(
      isExternalAlive({ activity: { state: 'quiet', lastEventAt: 'x', source: 'jsonl' } }),
    ).toBe(false)
  })

  it('gone wins over a present pid', () => {
    expect(isExternalAlive({ processLiveness: 'gone', pid: 4242 })).toBe(false)
  })

  it('falls back to a bare pid for older servers with no liveness fields', () => {
    expect(isExternalAlive({ pid: 4242 })).toBe(true)
  })

  it('does not apply the pid fallback once a new field is present', () => {
    // processLiveness 'unknown' is a new-server signal — the pid fallback must
    // not override it into "alive".
    expect(isExternalAlive({ processLiveness: 'unknown', pid: 4242 })).toBe(false)
  })

  it('is false for a managed session (no pid, no new fields)', () => {
    const managed: Pick<Session, 'processLiveness' | 'activity' | 'pid'> = {}
    expect(isExternalAlive(managed)).toBe(false)
  })
})
