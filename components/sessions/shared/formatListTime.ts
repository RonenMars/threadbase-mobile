// Convention: same-day items show HH:mm, yesterday shows the word,
// 2-6 days ago shows weekday, same year shows D MMM, older adds YY.
// See design/scratch/time-format-research.md for the cross-app analysis.

export interface FormatListTimeOptions {
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

  // Today: HH:mm.
  if (days <= 0) {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(tsDate)
  }

  // Yesterday.
  if (days === 1) return labels.yesterday

  // 2-6 days back: short weekday (Mon, Tue, …).
  if (days >= 2 && days <= 6) {
    return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(tsDate)
  }

  // Same calendar year: D MMM.
  if (tsDate.getFullYear() === nowDate.getFullYear()) {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(tsDate)
  }

  // Older: D MMM YY.
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  }).format(tsDate)
}

/**
 * Accessibility label — the full, verbose form for screen readers.
 * Always renders a complete weekday + date + time string.
 */
export function formatListTimeAccessible(
  input: string | number | Date | null | undefined,
  options: Pick<FormatListTimeOptions, 'locale'> = {},
): string {
  if (input == null) return ''
  const ts = toEpoch(input)
  if (!Number.isFinite(ts)) return ''

  return new Intl.DateTimeFormat(options.locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts))
}
