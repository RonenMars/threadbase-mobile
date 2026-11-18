import type { TFunction } from 'i18next'

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

/** Buckets that start expanded; every other bucket starts collapsed. */
const DEFAULT_OPEN = new Set(['lastHour', 'today', 'yesterday'])

export interface DayBucket<T> {
  key: string
  items: T[]
}

// Fixed keys: lastHour, today, yesterday, lastWeek, thisMonth, lastMonth.
// Dynamic keys: weekday-<0-6> (2-6 days back), month-<0-11> (older months of
// this year), year-<yyyy>. `rank` orders the sections newest-first.
function classify(ms: number, now: number): { key: string; rank: number } {
  if (now - ms < HOUR_MS) return { key: 'lastHour', rank: 0 }

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const day = new Date(ms)
  day.setHours(0, 0, 0, 0)
  // Rounded so a 23h or 25h DST day still counts as one day.
  const daysBack = Math.round((today.getTime() - day.getTime()) / DAY_MS)

  if (daysBack <= 0) return { key: 'today', rank: 1 }
  if (daysBack === 1) return { key: 'yesterday', rank: 2 }
  if (daysBack < 7) return { key: `weekday-${day.getDay()}`, rank: 1 + daysBack }

  const thisMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7))
  const lastMonday = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 7)
  if (day >= lastMonday && day < thisMonday) return { key: 'lastWeek', rank: 10 }

  const monthsBack = (today.getFullYear() - day.getFullYear()) * 12 + today.getMonth() - day.getMonth()
  if (monthsBack === 0) return { key: 'thisMonth', rank: 11 }
  if (monthsBack === 1) return { key: 'lastMonth', rank: 12 }
  if (day.getFullYear() === today.getFullYear()) return { key: `month-${day.getMonth()}`, rank: 100 + 11 - day.getMonth() }
  return { key: `year-${day.getFullYear()}`, rank: 1000 + 9999 - day.getFullYear() }
}

/** Newest-first non-empty buckets; items keep their input order inside a bucket. */
export function groupByDayBucket<T>(
  items: readonly T[],
  getMs: (item: T) => number,
  // Default param (not Date.now() in a component body) keeps callers clear of react-hooks/purity.
  now: number = Date.now(),
): DayBucket<T>[] {
  const byKey = new Map<string, { rank: number; items: T[] }>()
  for (const item of items) {
    const { key, rank } = classify(getMs(item), now)
    const bucket = byKey.get(key)
    if (bucket) bucket.items.push(item)
    else byKey.set(key, { rank, items: [item] })
  }
  return [...byKey.entries()].sort((a, b) => a[1].rank - b[1].rank).map(([key, { items: list }]) => ({ key, items: list }))
}

export function dayBucketLabel(key: string, t: TFunction<'sessions'>, locale: string): string {
  switch (key) {
    case 'lastHour':
      return t('live.headerLastHour')
    case 'today':
      return t('live.headerToday')
    case 'yesterday':
      return t('live.headerYesterday')
    case 'lastWeek':
      return t('live.headerLastWeek')
    case 'thisMonth':
      return t('live.headerThisMonth')
    case 'lastMonth':
      return t('live.headerLastMonth')
  }
  const [kind, value] = key.split('-')
  // 2023-01-01 was a Sunday, so it maps a getDay() index to a date with that weekday.
  if (kind === 'weekday') return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(2023, 0, 1 + Number(value))).toUpperCase()
  if (kind === 'month') return new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2023, Number(value), 1)).toUpperCase()
  return value
}

/** An explicit user choice wins; otherwise the bucket follows its default. */
export function isDayBucketOpen(overrides: Readonly<Record<string, boolean>>, key: string): boolean {
  return overrides[key] ?? DEFAULT_OPEN.has(key)
}
