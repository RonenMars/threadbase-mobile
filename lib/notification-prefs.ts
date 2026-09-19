import type {
  NotificationPreferences,
  QuietWindow,
  Weekday,
  WireNotificationPrefs,
} from '@/types/api'

export const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export function isValidTime(value: string | undefined): value is string {
  return typeof value === 'string' && HHMM.test(value)
}

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

function isKnownTimeZone(tz: string | undefined): tz is string {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/**
 * The streamer answers 400 for a zone it cannot resolve, and registration
 * carries these preferences, so a zone the device cannot name would fail the
 * whole registration and leave the phone with no push at all. Quiet hours are
 * left out instead; the toggles still sync.
 */
export function toWirePrefs(
  prefs: NotificationPreferences,
  tz: string | undefined = deviceTimeZone(),
): WireNotificationPrefs {
  const hasDays = Object.keys(prefs.quietHoursDays).length > 0
  return {
    waitingInput: prefs.waitingInput,
    sessionFailed: prefs.sessionFailed,
    ...(isKnownTimeZone(tz) && {
      quietHours: {
        enabled: prefs.quietHoursEnabled,
        tz,
        default: { from: prefs.quietHoursFrom, to: prefs.quietHoursTo },
        ...(hasDays && { days: prefs.quietHoursDays }),
      },
    }),
  }
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function windowStartingOn(prefs: NotificationPreferences, day: number): QuietWindow | null {
  const override = prefs.quietHoursDays[WEEKDAYS[day]]
  return override === undefined
    ? { from: prefs.quietHoursFrom, to: prefs.quietHoursTo }
    : override
}

/**
 * Whether the device's clock is inside the quiet hours it has configured.
 *
 * Mirrors the streamer's evaluation so the health screen previews what the
 * server will actually do: an overnight window belongs to the day it starts on,
 * and `from === to` is an empty window rather than 24 hours.
 */
export function isQuietNow(prefs: NotificationPreferences, now: Date = new Date()): boolean {
  if (!prefs.quietHoursEnabled) return false
  const day = (now.getDay() + 6) % 7
  const minutes = now.getHours() * 60 + now.getMinutes()

  const today = windowStartingOn(prefs, day)
  if (today) {
    const from = toMinutes(today.from)
    const to = toMinutes(today.to)
    if (from < to && minutes >= from && minutes < to) return true
    if (from > to && minutes >= from) return true
  }

  const yesterday = windowStartingOn(prefs, (day + 6) % 7)
  if (yesterday) {
    const from = toMinutes(yesterday.from)
    const to = toMinutes(yesterday.to)
    if (from > to && minutes < to) return true
  }
  return false
}

/** Persisted before the schema dropped Session Completed, Diff Ready and the badge. */
export interface StoredNotificationPreferences extends Partial<NotificationPreferences> {
  sessionComplete?: boolean
  diffReady?: boolean
  showBadge?: boolean
}

function coerceWindow(value: QuietWindow | null | undefined): QuietWindow | null | undefined {
  if (value === null) return null
  if (value && isValidTime(value.from) && isValidTime(value.to)) {
    return { from: value.from, to: value.to }
  }
  return undefined
}

/**
 * Bring a persisted blob onto the current shape.
 *
 * Copies only the keys that still exist, so a retired one (`sessionComplete`,
 * `diffReady`, `showBadge`) is dropped on the next persist rather than carried
 * forever, and anything malformed falls back to the default instead of reaching
 * the server.
 */
export function migrateNotificationPrefs(
  stored: StoredNotificationPreferences | undefined,
  base: NotificationPreferences,
): NotificationPreferences {
  if (!stored) return base
  const days: NotificationPreferences['quietHoursDays'] = {}
  for (const day of WEEKDAYS) {
    const window = coerceWindow(stored.quietHoursDays?.[day])
    if (window !== undefined) days[day] = window
  }
  return {
    waitingInput:
      typeof stored.waitingInput === 'boolean' ? stored.waitingInput : base.waitingInput,
    sessionFailed:
      typeof stored.sessionFailed === 'boolean' ? stored.sessionFailed : base.sessionFailed,
    quietHoursEnabled:
      typeof stored.quietHoursEnabled === 'boolean'
        ? stored.quietHoursEnabled
        : base.quietHoursEnabled,
    quietHoursFrom: isValidTime(stored.quietHoursFrom) ? stored.quietHoursFrom : base.quietHoursFrom,
    quietHoursTo: isValidTime(stored.quietHoursTo) ? stored.quietHoursTo : base.quietHoursTo,
    quietHoursDays: days,
  }
}
