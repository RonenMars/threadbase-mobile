import { formatListTime, formatListTimeAccessible } from '@/components/sessions/shared/formatListTime'

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
    it('one minute before midnight yesterday → "Yesterday"', () => {
      const lateYesterday = new Date(2026, 4, 14, 23, 59, 0).getTime()
      expect(fmt(lateYesterday)).toBe('Yesterday')
    })

    it('mid-day yesterday → "Yesterday"', () => {
      const yesterdayNoon = new Date(2026, 4, 14, 12, 0, 0).getTime()
      expect(fmt(yesterdayNoon)).toBe('Yesterday')
    })
  })

  describe('2-6 days ago → weekday short name', () => {
    it('2 days ago (Wed 13 May)', () => {
      const wed = new Date(2026, 4, 13, 10, 0, 0).getTime()
      expect(fmt(wed)).toBe('Wed')
    })

    it('6 days ago (Sat 9 May)', () => {
      const sixDaysAgo = new Date(2026, 4, 9, 10, 0, 0).getTime()
      expect(fmt(sixDaysAgo)).toBe('Sat')
    })
  })

  describe('older same year → D MMM', () => {
    it('7 days ago (boundary leaves weekday range)', () => {
      const sevenDaysAgo = new Date(2026, 4, 8, 10, 0, 0).getTime()
      expect(fmt(sevenDaysAgo)).toBe('8 May')
    })

    it('a few months earlier in the same year', () => {
      const earlier = new Date(2026, 0, 14, 10, 0, 0).getTime()
      expect(fmt(earlier)).toBe('14 Jan')
    })
  })

  describe('previous year → D MMM YY', () => {
    it('last December', () => {
      const lastDec = new Date(2025, 11, 31, 10, 0, 0).getTime()
      expect(fmt(lastDec)).toBe('31 Dec 25')
    })

    it('multiple years back', () => {
      const longAgo = new Date(2022, 2, 5, 10, 0, 0).getTime()
      expect(fmt(longAgo)).toBe('5 Mar 22')
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
      ).toBe('Ayer')

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
      expect(formatListTime(yesterdayEvening, { now, locale: 'en-GB' })).toBe('Yesterday')
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
