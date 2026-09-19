import {
  isQuietNow,
  isValidTime,
  migrateNotificationPrefs,
  toWirePrefs,
} from '@/lib/notification-prefs'
import type { NotificationPreferences } from '@/types/api'

/**
 * The health screen previews what the server will do, so isQuietNow has to
 * agree with the streamer: an overnight window belongs to the day it starts on,
 * and from === to is empty. Every "not quiet" case sits beside a "quiet" one.
 *
 * 2024-01-01 is a Monday. Dates are local, as the app reads the device clock.
 */

const prefs = (over: Partial<NotificationPreferences> = {}): NotificationPreferences => ({
  waitingInput: true,
  sessionFailed: true,
  quietHoursEnabled: true,
  quietHoursFrom: '22:00',
  quietHoursTo: '08:00',
  quietHoursDays: {},
  ...over,
})

const at = (local: string) => new Date(`${local}:00`)

describe('isQuietNow', () => {
  it('is never quiet while disabled', () => {
    expect(isQuietNow(prefs({ quietHoursEnabled: false }), at('2024-01-01T23:00'))).toBe(false)
    expect(isQuietNow(prefs(), at('2024-01-01T23:00'))).toBe(true)
  })

  it('carries an overnight window across midnight', () => {
    expect(isQuietNow(prefs(), at('2024-01-01T21:59'))).toBe(false)
    expect(isQuietNow(prefs(), at('2024-01-01T22:00'))).toBe(true)
    expect(isQuietNow(prefs(), at('2024-01-02T07:59'))).toBe(true)
    expect(isQuietNow(prefs(), at('2024-01-02T08:00'))).toBe(false)
    expect(isQuietNow(prefs(), at('2024-01-01T12:00'))).toBe(false)
  })

  it('handles a same-day window, start inclusive and end exclusive', () => {
    const p = prefs({ quietHoursFrom: '12:00', quietHoursTo: '14:00' })
    expect(isQuietNow(p, at('2024-01-01T11:59'))).toBe(false)
    expect(isQuietNow(p, at('2024-01-01T12:00'))).toBe(true)
    expect(isQuietNow(p, at('2024-01-01T13:59'))).toBe(true)
    expect(isQuietNow(p, at('2024-01-01T14:00'))).toBe(false)
  })

  it('treats from === to as an empty window, not 24 hours', () => {
    const p = prefs({ quietHoursFrom: '10:00', quietHoursTo: '10:00' })
    expect(isQuietNow(p, at('2024-01-01T10:00'))).toBe(false)
    expect(isQuietNow(p, at('2024-01-01T15:00'))).toBe(false)
  })

  describe('per-weekday overrides', () => {
    it('a null day cancels that evening and the tail of its window, but not the previous night', () => {
      const p = prefs({ quietHoursDays: { mon: null } })
      expect(isQuietNow(p, at('2024-01-01T23:00'))).toBe(false) // Monday evening
      expect(isQuietNow(p, at('2024-01-02T03:00'))).toBe(false) // tail of Monday's window
      expect(isQuietNow(p, at('2024-01-01T03:00'))).toBe(true) // tail of Sunday's default window
      expect(isQuietNow(p, at('2024-01-02T23:00'))).toBe(true) // Tuesday evening unaffected
    })

    it('an override replaces the default for the window that starts that day', () => {
      const p = prefs({ quietHoursDays: { mon: { from: '23:30', to: '10:00' } } })
      expect(isQuietNow(p, at('2024-01-01T23:00'))).toBe(false)
      expect(isQuietNow(p, at('2024-01-01T23:30'))).toBe(true)
      expect(isQuietNow(p, at('2024-01-02T09:00'))).toBe(true)
      expect(isQuietNow(p, at('2024-01-02T10:00'))).toBe(false)
    })
  })
})

describe('toWirePrefs', () => {
  it('reshapes the flat store fields to what the server stores', () => {
    expect(toWirePrefs(prefs({ waitingInput: false }), 'Asia/Jerusalem')).toEqual({
      waitingInput: false,
      sessionFailed: true,
      quietHours: {
        enabled: true,
        tz: 'Asia/Jerusalem',
        default: { from: '22:00', to: '08:00' },
      },
    })
  })

  it('includes per-day overrides only when there are some', () => {
    const days = { fri: { from: '23:30', to: '10:00' }, sat: null }
    expect(toWirePrefs(prefs({ quietHoursDays: days }), 'UTC').quietHours?.days).toEqual(days)
    expect(toWirePrefs(prefs(), 'UTC').quietHours).not.toHaveProperty('days')
  })

  it("reports the device's own time zone by default", () => {
    expect(toWirePrefs(prefs()).quietHours?.tz).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
  })

  // A zone the streamer cannot resolve is a 400, and registration carries these
  // preferences: it must cost the schedule, never the registration.
  it.each(['', 'Mars/Olympus', 'GMT+03:00 nonsense'])(
    'leaves quiet hours out for the unusable zone %p and still sends the toggles',
    (zone) => {
      expect(toWirePrefs(prefs({ waitingInput: false }), zone)).toEqual({
        waitingInput: false,
        sessionFailed: true,
      })
      // Positive control: a real zone keeps them, so the omission above is the zone's doing.
      expect(toWirePrefs(prefs(), 'Asia/Jerusalem').quietHours?.tz).toBe('Asia/Jerusalem')
    },
  )

  it('leaves quiet hours out when the device reports no zone at all', () => {
    const real = Intl.DateTimeFormat().resolvedOptions()
    const spy = jest
      .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
      .mockReturnValue({ ...real, timeZone: '' })
    try {
      expect(toWirePrefs(prefs({ waitingInput: false }))).toEqual({
        waitingInput: false,
        sessionFailed: true,
      })
    } finally {
      spy.mockRestore()
    }
    expect(toWirePrefs(prefs()).quietHours?.tz).toBe(real.timeZone)
  })
})

describe('isValidTime', () => {
  it.each(['00:00', '09:05', '23:59'])('accepts %s', (v) => expect(isValidTime(v)).toBe(true))
  it.each(['24:00', '9:00', '12:60', 'noon', '', undefined])('rejects %s', (v) =>
    expect(isValidTime(v)).toBe(false),
  )
})

describe('migrateNotificationPrefs', () => {
  it('returns the defaults when nothing was stored', () => {
    expect(migrateNotificationPrefs(undefined, prefs())).toEqual(prefs())
  })

  it('ignores a non-boolean toggle', () => {
    const stored = { waitingInput: 'yes' } as unknown as Partial<NotificationPreferences>
    expect(migrateNotificationPrefs(stored, prefs()).waitingInput).toBe(true)
  })
})
