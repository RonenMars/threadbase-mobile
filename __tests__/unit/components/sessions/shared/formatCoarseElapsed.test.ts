import { formatCoarseElapsed, formatWaitSince, waitSinceIso } from '@/components/sessions/shared/formatCoarseElapsed'

const NOW = new Date(2026, 4, 15, 14, 35, 0).getTime()

describe('formatCoarseElapsed', () => {
  it('floors to whole seconds under a minute', () => {
    expect(formatCoarseElapsed(0)).toBe('0s')
    expect(formatCoarseElapsed(45_000)).toBe('45s')
    expect(formatCoarseElapsed(59_999)).toBe('59s')
  })

  it('switches to minutes at 60s', () => {
    expect(formatCoarseElapsed(60_000)).toBe('1m')
    expect(formatCoarseElapsed(2 * 60_000)).toBe('2m')
  })

  it('switches to hours at 60m and keeps the leftover minutes', () => {
    expect(formatCoarseElapsed(60 * 60_000)).toBe('1h 0m')
    expect(formatCoarseElapsed(65 * 60_000)).toBe('1h 5m')
  })

  it('never goes negative', () => {
    expect(formatCoarseElapsed(-5_000)).toBe('0s')
  })
})

describe('formatWaitSince', () => {
  it('returns null when the stamp is missing or unparseable', () => {
    expect(formatWaitSince(undefined, NOW)).toBeNull()
    expect(formatWaitSince(null, NOW)).toBeNull()
    expect(formatWaitSince('not-a-date', NOW)).toBeNull()
  })

  it('measures from statusUpdatedAt, not from session start', () => {
    expect(formatWaitSince(new Date(NOW - 2 * 60_000).toISOString(), NOW)).toBe('2m')
    expect(formatWaitSince(new Date(NOW - 45_000).toISOString(), NOW)).toBe('45s')
  })

  it('clamps a future stamp (clock skew) to 0s', () => {
    expect(formatWaitSince(new Date(NOW + 30_000).toISOString(), NOW)).toBe('0s')
  })
})

describe('waitSinceIso', () => {
  const waitStart = new Date(NOW - 2 * 60_000).toISOString()
  const lastEvent = new Date(NOW - 45_000).toISOString()

  it('prefers the status flip over the JSONL tail', () => {
    expect(waitSinceIso({ statusUpdatedAt: waitStart, activity: { lastEventAt: lastEvent } })).toBe(waitStart)
  })

  it('falls back to lastEventAt when the wait stamp is missing', () => {
    expect(waitSinceIso({ activity: { lastEventAt: lastEvent } })).toBe(lastEvent)
  })

  it('returns undefined when neither stamp is present', () => {
    expect(waitSinceIso({})).toBeUndefined()
    expect(waitSinceIso({ activity: null })).toBeUndefined()
  })
})
