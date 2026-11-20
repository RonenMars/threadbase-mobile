import { useMemo } from 'react'
import { useSettingsStore } from '@/stores/settings'
import type { DateTimeFormatPrefs } from '@/lib/dateTimeFormat'
import { formatTimeOfDay } from '@/lib/dateTimeFormat'
import {
  formatListTime,
  formatListTimeAccessible,
  type FormatListTimeOptions,
} from '@/components/sessions/shared/formatListTime'

type Input = string | number | Date | null | undefined

/**
 * The device's date/time format choice plus formatters bound to it. Anything
 * that writes a timestamp into a string (a joined meta line, a translated
 * sentence) uses this; a timestamp that stands alone in a <Text> uses <DateTime>.
 * Subscribing here is what re-renders a screen when the choice changes.
 */
export function useDateTimeFormat() {
  const date = useSettingsStore((s) => s.dateFormat)
  const time = useSettingsStore((s) => s.timeFormat)

  return useMemo(() => {
    const format: DateTimeFormatPrefs = { date, time }
    return {
      format,
      /** Relative-to-now label: "14:35", "Yesterday 14:35", "8 May 14:35". */
      formatList: (input: Input, options: Omit<FormatListTimeOptions, 'format'> = {}) =>
        formatListTime(input, { ...options, format }),
      /** Full weekday, date and time, for screen readers. */
      formatAccessible: (input: Input, locale?: string) =>
        formatListTimeAccessible(input, { locale, format }),
      /** Time of day only; '' for a missing or unparsable value. */
      formatTime: (input: Input, locale?: string) => {
        if (input == null || input === '') return ''
        const d = new Date(input)
        return Number.isFinite(d.getTime()) ? formatTimeOfDay(d, time, locale) : ''
      },
    }
  }, [date, time])
}
