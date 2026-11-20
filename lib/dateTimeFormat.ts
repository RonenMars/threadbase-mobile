// How the app writes dates and times. One choice per device (stores/settings.ts);
// every displayed timestamp goes through <DateTime> / useDateTimeFormat, which
// end up here.

export type DateFormat = 'auto' | 'dmy' | 'mdy' | 'ymd'
export type TimeFormat = '24h' | '12h' | 'auto'

export interface DateTimeFormatPrefs {
  date: DateFormat
  time: TimeFormat
}

// Matches what the app showed before the picker existed: the device locale's
// own date order and a forced 24-hour clock.
export const DEFAULT_DATE_TIME_FORMAT: DateTimeFormatPrefs = { date: 'auto', time: '24h' }

export const DATE_FORMATS: readonly DateFormat[] = ['auto', 'dmy', 'mdy', 'ymd']
export const TIME_FORMATS: readonly TimeFormat[] = ['24h', '12h', 'auto']

export function coerceDateFormat(value: unknown): DateFormat {
  return DATE_FORMATS.find((f) => f === value) ?? DEFAULT_DATE_TIME_FORMAT.date
}

export function coerceTimeFormat(value: unknown): TimeFormat {
  return TIME_FORMATS.find((f) => f === value) ?? DEFAULT_DATE_TIME_FORMAT.time
}

/** Time of day, e.g. "14:35" or "2:35 PM". */
export function formatTimeOfDay(date: Date, time: TimeFormat, locale?: string): string {
  const options: Intl.DateTimeFormatOptions =
    time === '24h'
      ? { hour: '2-digit', minute: '2-digit', hour12: false }
      : time === '12h'
        ? { hour: 'numeric', minute: '2-digit', hour12: true }
        : { hour: '2-digit', minute: '2-digit' }
  return new Intl.DateTimeFormat(locale, options).format(date)
}

// A fixed locale: the YYYY-MM-DD layout must not follow the device.
// eslint-disable-next-line i18next/no-literal-string -- BCP 47 tag, not copy
const ISO_LOCALE = 'en-US'

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? ''
}

/**
 * A calendar date without the weekday. `withYear` is false for a date in the
 * current year, which is how the list rows keep their short form.
 */
export function formatDatePart(
  date: Date,
  dateFormat: DateFormat,
  withYear: boolean,
  locale?: string,
): string {
  if (dateFormat === 'auto') {
    return withYear
      ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: '2-digit' }).format(date)
      : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(date)
  }

  if (dateFormat === 'ymd') {
    const parts = new Intl.DateTimeFormat(ISO_LOCALE, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)
    return `${part(parts, 'year')}-${part(parts, 'month')}-${part(parts, 'day')}`
  }

  const parts = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  }).formatToParts(date)
  const day = part(parts, 'day')
  const month = part(parts, 'month')
  const year = part(parts, 'year')
  if (dateFormat === 'dmy') return withYear ? `${day} ${month} ${year}` : `${day} ${month}`
  return withYear ? `${month} ${day}, ${year}` : `${month} ${day}`
}
