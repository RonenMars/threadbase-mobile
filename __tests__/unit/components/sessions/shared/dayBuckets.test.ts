import { dayBucketLabel, groupByDayBucket, isDayBucketOpen } from '@/components/sessions/shared/dayBuckets'

// Wednesday 2026-11-18 12:00 local, so the week runs Mon 16th to Sun 22nd.
const NOW = new Date(2026, 10, 18, 12, 0).getTime()
const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h, 0).getTime()

const keyOf = (ms: number, now = NOW) => groupByDayBucket([ms], (x) => x, now)[0].key

describe('groupByDayBucket', () => {
  it.each([
    ['30 minutes ago', NOW - 30 * 60_000, 'lastHour'],
    ['a future timestamp (clock skew)', NOW + 5 * 60_000, 'lastHour'],
    ['earlier today', at(2026, 11, 18, 8), 'today'],
    ['yesterday evening', at(2026, 11, 17, 23), 'yesterday'],
    ['Monday, 2 days back', at(2026, 11, 16), 'weekday-1'],
    ['Thursday, 6 days back', at(2026, 11, 12), 'weekday-4'],
    ['last Wednesday, 7 days back', at(2026, 11, 11), 'lastWeek'],
    ['last Monday', at(2026, 11, 9, 0), 'lastWeek'],
    ['the Sunday before last week', at(2026, 11, 8), 'thisMonth'],
    ['early this month', at(2026, 11, 1), 'thisMonth'],
    ['last month', at(2026, 10, 20), 'lastMonth'],
    ['an older month this year', at(2026, 3, 5), 'month-2'],
    ['last year', at(2025, 12, 30), 'year-2025'],
  ])('puts %s in %s', (_label, ms, key) => {
    expect(keyOf(ms)).toBe(key)
  })

  it('counts December as last month in January', () => {
    const january = new Date(2027, 0, 10, 12, 0).getTime()
    expect(keyOf(at(2026, 12, 5), january)).toBe('lastMonth')
  })

  it('counts a day back by calendar day, not by 24-hour blocks', () => {
    const justAfterMidnight = new Date(2026, 10, 18, 0, 30).getTime()
    expect(keyOf(new Date(2026, 10, 17, 23, 45).getTime(), justAfterMidnight)).toBe('lastHour')
    expect(keyOf(at(2026, 11, 17, 20), justAfterMidnight)).toBe('yesterday')
  })

  it('orders buckets newest-first and keeps input order inside one', () => {
    const items = [
      at(2024, 6, 1),
      at(2025, 12, 30),
      at(2026, 2, 3),
      at(2026, 3, 5),
      at(2026, 10, 20),
      at(2026, 11, 1),
      at(2026, 11, 11),
      at(2026, 11, 12),
      at(2026, 11, 16),
      at(2026, 11, 17, 23),
      at(2026, 11, 18, 8),
      at(2026, 11, 18, 7),
      NOW - 60_000,
    ]
    const groups = groupByDayBucket(items, (x) => x, NOW)
    expect(groups.map((g) => g.key)).toEqual([
      'lastHour', 'today', 'yesterday', 'weekday-1', 'weekday-4', 'lastWeek', 'thisMonth', 'lastMonth', 'month-2', 'month-1', 'year-2025', 'year-2024',
    ])
    expect(groups[1].items).toEqual([at(2026, 11, 18, 8), at(2026, 11, 18, 7)])
  })

  it('returns no buckets for no items', () => {
    expect(groupByDayBucket([], (x: number) => x, NOW)).toEqual([])
  })
})

describe('dayBucketLabel', () => {
  const t = ((key: string) => key) as Parameters<typeof dayBucketLabel>[1]

  it('translates the fixed buckets and names the dynamic ones from the locale', () => {
    expect(dayBucketLabel('today', t, 'en')).toBe('live.headerToday')
    expect(dayBucketLabel('lastWeek', t, 'en')).toBe('live.headerLastWeek')
    expect(dayBucketLabel('weekday-1', t, 'en')).toBe('MONDAY')
    expect(dayBucketLabel('weekday-0', t, 'en')).toBe('SUNDAY')
    expect(dayBucketLabel('month-2', t, 'en')).toBe('MARCH')
    expect(dayBucketLabel('year-2025', t, 'en')).toBe('2025')
  })
})

describe('isDayBucketOpen', () => {
  it('opens only the recent buckets by default', () => {
    expect(isDayBucketOpen({}, 'lastHour')).toBe(true)
    expect(isDayBucketOpen({}, 'today')).toBe(true)
    expect(isDayBucketOpen({}, 'yesterday')).toBe(true)
    expect(isDayBucketOpen({}, 'weekday-1')).toBe(false)
    expect(isDayBucketOpen({}, 'year-2025')).toBe(false)
  })

  it('lets an explicit choice win over the default', () => {
    expect(isDayBucketOpen({ today: false }, 'today')).toBe(false)
    expect(isDayBucketOpen({ 'year-2025': true }, 'year-2025')).toBe(true)
  })
})
