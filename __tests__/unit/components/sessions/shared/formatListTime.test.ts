import { formatListTime, formatListTimeAccessible } from '@/components/sessions/shared/formatListTime'
import type { DateTimeFormatPrefs } from '@/lib/dateTimeFormat'

// Fixed "now" for deterministic assertions:
// Friday, 15 May 2026, 14:35 local time.
const NOW = new Date(2026, 4, 15, 14, 35, 0).getTime()

const fmt = (when: Date | string | number | null | undefined) =>
  formatListTime(when, { now: NOW, locale: 'en-GB' })

describe('formatListTime', () => {
  describe('clock skew / future / sub-minute', () => {
    it('returns "now" for the exact now', () => {
      expect(fmt(NOW)).toBe('now')
    })

    it('returns "now" for 30 seconds ago', () => {
      expect(fmt(NOW - 30 * 1000)).toBe('now')
    })

    it('returns "now" for a future timestamp (clock skew)', () => {
      expect(fmt(NOW + 60_000)).toBe('now')
    })

    it('returns "" for null / undefined', () => {
      expect(fmt(null)).toBe('')
      expect(fmt(undefined)).toBe('')
    })

    it('returns "" for an unparseable string', () => {
      expect(fmt('not-a-date')).toBe('')
    })
  })

  describe('same calendar day → HH:mm', () => {
    it('5 minutes ago, same day', () => {
      expect(fmt(NOW - 5 * 60 * 1000)).toBe('14:30')
    })

    it('a few hours ago, same day', () => {
      const earlier = new Date(2026, 4, 15, 9, 7, 0).getTime()
      expect(fmt(earlier)).toBe('09:07')
    })

    it('00:35 the same calendar day (was 14h ago — fixes the 23h-ambiguity bug)', () => {
      const earlyToday = new Date(2026, 4, 15, 0, 35, 0).getTime()
      expect(fmt(earlyToday)).toBe('00:35')
    })
  })

  describe('yesterday', () => {
    it('one minute before midnight yesterday → "Yesterday HH:mm"', () => {
      const lateYesterday = new Date(2026, 4, 14, 23, 59, 0).getTime()
      expect(fmt(lateYesterday)).toBe('Yesterday 23:59')
    })

    it('mid-day yesterday → "Yesterday HH:mm"', () => {
      const yesterdayNoon = new Date(2026, 4, 14, 12, 0, 0).getTime()
      expect(fmt(yesterdayNoon)).toBe('Yesterday 12:00')
    })
  })

  describe('2-6 days ago → weekday + time', () => {
    it('2 days ago (Wed 13 May)', () => {
      const wed = new Date(2026, 4, 13, 10, 0, 0).getTime()
      expect(fmt(wed)).toBe('Wed 10:00')
    })

    it('6 days ago (Sat 9 May)', () => {
      const sixDaysAgo = new Date(2026, 4, 9, 10, 0, 0).getTime()
      expect(fmt(sixDaysAgo)).toBe('Sat 10:00')
    })
  })

  describe('older same year → D MMM + time', () => {
    it('7 days ago (boundary leaves weekday range)', () => {
      const sevenDaysAgo = new Date(2026, 4, 8, 10, 0, 0).getTime()
      expect(fmt(sevenDaysAgo)).toBe('8 May 10:00')
    })

    it('a few months earlier in the same year', () => {
      const earlier = new Date(2026, 0, 14, 10, 0, 0).getTime()
      expect(fmt(earlier)).toBe('14 Jan 10:00')
    })
  })

  describe('previous year → D MMM YY + time', () => {
    it('last December', () => {
      const lastDec = new Date(2025, 11, 31, 10, 0, 0).getTime()
      expect(fmt(lastDec)).toBe('31 Dec 25 10:00')
    })

    it('multiple years back', () => {
      const longAgo = new Date(2022, 2, 5, 10, 0, 0).getTime()
      expect(fmt(longAgo)).toBe('5 Mar 22 10:00')
    })
  })

  describe('input shapes', () => {
    it('accepts Date instance', () => {
      const d = new Date(NOW - 5 * 60 * 1000)
      expect(fmt(d)).toBe('14:30')
    })

    it('accepts ISO string', () => {
      const iso = new Date(2026, 4, 15, 9, 7, 0).toISOString()
      expect(fmt(iso)).toBe('09:07')
    })

    it('accepts epoch number', () => {
      expect(fmt(NOW - 5 * 60 * 1000)).toBe('14:30')
    })
  })

  describe('locale labels', () => {
    it('uses provided labels for now and yesterday', () => {
      const lateYesterday = new Date(2026, 4, 14, 23, 59, 0).getTime()
      expect(
        formatListTime(lateYesterday, {
          now: NOW,
          locale: 'en-GB',
          labels: { now: 'agora', yesterday: 'Ayer' },
        }),
      ).toBe('Ayer 23:59')

      expect(
        formatListTime(NOW - 10_000, {
          now: NOW,
          locale: 'en-GB',
          labels: { now: 'agora', yesterday: 'Ayer' },
        }),
      ).toBe('agora')
    })
  })

  describe('DST robustness', () => {
    it('treats a 23-hour gap that crosses midnight as Yesterday, not same-day', () => {
      // Pick a deliberate cross-midnight pair (no DST shift needed — the
      // calendar-day comparison alone protects against the "23h ago"
      // wrap-around bug).
      const now = new Date(2026, 4, 15, 1, 0, 0).getTime()
      const yesterdayEvening = new Date(2026, 4, 14, 2, 0, 0).getTime()
      expect(formatListTime(yesterdayEvening, { now, locale: 'en-GB' })).toBe('Yesterday 02:00')
    })
  })
})

describe('formatListTimeAccessible', () => {
  it('renders the full verbose form', () => {
    const value = formatListTimeAccessible(NOW, { locale: 'en-GB' })
    expect(value).toMatch(/Friday/)
    expect(value).toMatch(/15 May 2026/)
    expect(value).toMatch(/14:35/)
  })

  it('returns "" for null', () => {
    expect(formatListTimeAccessible(null)).toBe('')
  })
})

describe('formatListTime – format preference', () => {
  const sameYear = new Date(2026, 4, 8, 15, 0, 0).getTime()
  const lastYear = new Date(2025, 11, 31, 15, 0, 0).getTime()
  const withFormat = (when: number, format: DateTimeFormatPrefs) =>
    formatListTime(when, { now: NOW, locale: 'en-GB', format })

  it('mdy reorders an older same-year date', () => {
    expect(withFormat(sameYear, { date: 'mdy', time: '24h' })).toBe('May 8 15:00')
  })

  it('ymd writes the full numeric date, even in the same year', () => {
    expect(withFormat(sameYear, { date: 'ymd', time: '24h' })).toBe('2026-05-08 15:00')
    expect(withFormat(lastYear, { date: 'ymd', time: '24h' })).toBe('2025-12-31 15:00')
  })

  it('12h switches the clock on every branch', () => {
    const same = formatListTime(NOW - 5 * 60 * 1000, { now: NOW, locale: 'en-US', format: { date: 'auto', time: '12h' } })
    expect(same).toMatch(/^2:30\s?PM$/)
    expect(withFormat(sameYear, { date: 'dmy', time: '12h' })).toMatch(/^8 May 3:00\s?pm$/i)
  })

  it('"now" is unaffected by the preference', () => {
    expect(withFormat(NOW - 10_000, { date: 'ymd', time: '12h' })).toBe('now')
  })

  it('accessible label follows the clock choice', () => {
    expect(formatListTimeAccessible(NOW, { locale: 'en-US', format: { date: 'auto', time: '12h' } })).toMatch(/2:35\s?PM/)
    expect(formatListTimeAccessible(NOW, { locale: 'en-US' })).toMatch(/14:35/)
  })
})
