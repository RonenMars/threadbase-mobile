// Convention: same-day items show the time (HH:mm unless the user picked 12-hour), all other items show the date label
// followed by the time (e.g. "Yesterday 14:35", "Mon 09:07", "8 May 14:35").
// See design/scratch/time-format-research.md for the cross-app analysis.

import {
  DEFAULT_DATE_TIME_FORMAT,
  formatDatePart,
  formatTimeOfDay,
  type DateTimeFormatPrefs,
} from '@/lib/dateTimeFormat'

export interface FormatListTimeOptions {
  /** The device's date/time format choice; defaults to the app default. */
  format?: DateTimeFormatPrefs
  /** Reference "now" for testing; defaults to Date.now(). */
  now?: number | Date
  /** Locale tag (e.g. "en-US"); defaults to runtime locale. */
  locale?: string
  /** Translations for the two textual labels. Defaults to English. */
  labels?: { now: string; yesterday: string }
}

const DEFAULT_LABELS = { now: 'now', yesterday: 'Yesterday' }

function toEpoch(input: string | number | Date): number {
  if (input instanceof Date) return input.getTime()
  if (typeof input === 'number') return input
  return Date.parse(input)
}

function startOfDay(epoch: number): number {
  const d = new Date(epoch)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function dayDiff(from: number, to: number): number {
  // Calendar-day diff, robust to DST boundaries (subtracts at midnight, not wall-clock).
  return Math.round((startOfDay(to) - startOfDay(from)) / 86_400_000)
}

export function formatListTime(
  input: string | number | Date | null | undefined,
  options: FormatListTimeOptions = {},
): string {
  if (input == null) return ''
  const ts = toEpoch(input)
  if (!Number.isFinite(ts)) return ''

  const nowMs = options.now instanceof Date ? options.now.getTime() : options.now ?? Date.now()
  const labels = options.labels ?? DEFAULT_LABELS
  const locale = options.locale
  const tsDate = new Date(ts)
  const nowDate = new Date(nowMs)

  const ageSec = (nowMs - ts) / 1000

  // Clock skew or future timestamp → treat as now.
  if (ageSec < 60) return labels.now

  const days = dayDiff(ts, nowMs)

  const format = options.format ?? DEFAULT_DATE_TIME_FORMAT
  const timePart = formatTimeOfDay(tsDate, format.time, locale)

  // Today: HH:mm only.
  if (days <= 0) return timePart

  // Yesterday: "Yesterday HH:mm".
  if (days === 1) return `${labels.yesterday} ${timePart}`

  // 2-6 days back: "Mon HH:mm".
  if (days >= 2 && days <= 6) {
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(tsDate)
    return `${weekday} ${timePart}`
  }

  // Same calendar year the year is left off; older dates carry it.
  const sameYear = tsDate.getFullYear() === nowDate.getFullYear()
  return `${formatDatePart(tsDate, format.date, !sameYear, locale)} ${timePart}`
}

/**
 * Accessibility label — the full, verbose form for screen readers.
 * Always renders a complete weekday + date + time string.
 */
export function formatListTimeAccessible(
  input: string | number | Date | null | undefined,
  options: Pick<FormatListTimeOptions, 'locale' | 'format'> = {},
): string {
  if (input == null) return ''
  const ts = toEpoch(input)
  if (!Number.isFinite(ts)) return ''

  const hour12 = (options.format ?? DEFAULT_DATE_TIME_FORMAT).time
  return new Intl.DateTimeFormat(options.locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: hour12 === '12h' ? 'numeric' : '2-digit',
    minute: '2-digit',
    ...(hour12 === 'auto' ? {} : { hour12: hour12 === '12h' }),
  }).format(new Date(ts))
}
